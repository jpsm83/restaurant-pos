/**
 * Notification inbox service tests — request shape and failure mapping.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchNotificationsInbox,
  useNotificationsInboxQuery,
} from "../notificationsService";

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock("../../http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
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

describe("notificationsService", () => {
  beforeEach(() => {
    mockGet.mockReset();
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
});
