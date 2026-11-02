/**
 * Notification inbox service tests — request shape and failure mapping.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../queryKeys";
import {
  fetchNotificationsInbox,
  hideNotificationInboxEntry,
  markAllNotificationsRead,
  markNotificationRead,
  useNotificationInboxActionMutation,
  useNotificationsInboxQuery,
} from "../notificationsService";

const { mockGet, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("../../http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

const inboxPage = {
  items: [
    {
      notificationId: "n1",
      businessId: "b1",
      notificationType: "Info",
      message: "Your order is ready.",
      createdAt: "2026-03-27T10:15:00.000Z",
      read: false,
    },
  ],
  unreadCount: 1,
  page: 1,
  limit: 20,
  hasMore: false,
};

function axiosFailure(status: number, type: string) {
  const response = {
    status,
    data: { type: `https://restaurant-pos.app/errors/${type}` },
  } as AxiosResponse;
  return new AxiosError(
    type,
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    response,
  );
}

describe("notificationsService", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockDelete.mockReset();
  });

  it("reads the session-derived inbox page without a User id", async () => {
    mockGet.mockResolvedValue({ data: inboxPage });
    const controller = new AbortController();

    await expect(
      fetchNotificationsInbox(2, controller.signal),
    ).resolves.toEqual(inboxPage);

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/notifications/inbox?page=2",
      { signal: controller.signal },
    );
  });

  it("maps failures to the inbox machine-code contract", async () => {
    const response = {
      status: 500,
      data: { type: "https://restaurant-pos.app/errors/internal" },
    } as AxiosResponse;
    mockGet.mockRejectedValue(
      new AxiosError("internal", "ERR_BAD_RESPONSE", undefined, undefined, response),
    );

    await expect(fetchNotificationsInbox()).rejects.toMatchObject({
      code: "notificationsFetch.internal",
      status: 500,
    });
  });

  it("loads the next page while the response reports more entries", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { ...inboxPage, hasMore: true },
      })
      .mockResolvedValueOnce({
        data: { ...inboxPage, page: 2, items: [], unreadCount: 0 },
      });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () => useNotificationsInboxQuery("u1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(result.current.data?.pages).toHaveLength(2);
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      "/api/v1/notifications/inbox?page=2",
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("marks one entry read through its session-derived path", async () => {
    const response = { notificationId: "n1", read: true };
    mockPatch.mockResolvedValue({ data: response });

    await expect(markNotificationRead("n1")).resolves.toEqual(response);

    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v1/notifications/inbox/n1/read",
    );
  });

  it("marks every visible entry read", async () => {
    mockPatch.mockResolvedValue({ data: { unreadCount: 0 } });

    await expect(markAllNotificationsRead()).resolves.toEqual({
      unreadCount: 0,
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/api/v1/notifications/inbox/read-all",
    );
  });

  it("hides one entry from the caller's inbox", async () => {
    const response = { notificationId: "n1", hidden: true };
    mockDelete.mockResolvedValue({ data: response });

    await expect(hideNotificationInboxEntry("n1")).resolves.toEqual(response);

    expect(mockDelete).toHaveBeenCalledWith(
      "/api/v1/notifications/inbox/n1",
    );
  });

  it.each([
    ["read", () => markNotificationRead("n1"), mockPatch],
    ["read-all", () => markAllNotificationsRead(), mockPatch],
    ["delete", () => hideNotificationInboxEntry("n1"), mockDelete],
  ])(
    "maps a %s failure to its inbox action contract",
    async (_name, request, mockRequest) => {
      mockRequest.mockRejectedValue(axiosFailure(500, "internal"));

      await expect(request()).rejects.toMatchObject({
        code: expect.stringMatching(/^notifications(Read|ReadAll|Delete)\./),
        status: 500,
      });
    },
  );

  it("invalidates the inbox after every successful action", async () => {
    mockPatch.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () => useNotificationInboxActionMutation(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        type: "markRead",
        notificationId: "n1",
      });
      await result.current.mutateAsync({ type: "markAllRead" });
      await result.current.mutateAsync({ type: "hide", notificationId: "n1" });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications.inboxAll(),
    });
  });

  it("leaves the inbox untouched when an action fails", async () => {
    mockPatch.mockRejectedValue(axiosFailure(500, "internal"));
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () => useNotificationInboxActionMutation(),
      { wrapper },
    );

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          type: "markRead",
          notificationId: "n1",
        }),
      ).rejects.toMatchObject({ code: "notificationsRead.internal" });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
