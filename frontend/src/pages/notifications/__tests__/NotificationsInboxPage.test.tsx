import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  INotificationInboxItem,
  INotificationInboxResponse,
} from "restaurant-pos-packages/interfaces/INotification";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDateTime } from "@/i18n/format";
import type { LiveNotificationEvent } from "@/live/connection";
import { ServiceRequestError } from "@/services/serviceErrors";
import { createTestI18n, renderWithI18n } from "@/test/i18nTestUtils";
import NotificationsInboxPage from "../NotificationsInboxPage";

const { mockInboxQuery, mockActionMutation, mockSubscribeLiveNotifications } =
  vi.hoisted(() => ({
    mockInboxQuery: { current: {} as Record<string, unknown> },
    mockActionMutation: { current: {} as Record<string, unknown> },
    mockSubscribeLiveNotifications: vi.fn(),
  }));

vi.mock("@/services/notifications/notificationsService", () => ({
  useNotificationsInboxQuery: () => mockInboxQuery.current,
  useNotificationInboxActionMutation: () => mockActionMutation.current,
}));

vi.mock("@/live/connection", () => ({
  subscribeLiveNotifications: mockSubscribeLiveNotifications,
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      status: "authenticated",
      user: {
        id: "u1",
        email: "u@test.local",
        type: "user",
        role: "Customer",
      },
      error: null,
    },
  }),
}));

function entry(
  overrides: Partial<INotificationInboxItem> = {},
): INotificationInboxItem {
  return {
    notificationId: "n1",
    businessId: "b1",
    notificationType: "Info",
    content: { kind: "text", text: "Your order is ready." },
    createdAt: "2026-03-27T10:15:00.000Z",
    read: false,
    ...overrides,
  };
}

function page(
  items: INotificationInboxItem[],
  overrides: Partial<INotificationInboxResponse> = {},
): INotificationInboxResponse {
  return {
    items,
    unreadCount: items.filter((item) => !item.read).length,
    page: 1,
    limit: 20,
    hasMore: false,
    ...overrides,
  };
}

function setQuery(overrides: Record<string, unknown> = {}) {
  mockInboxQuery.current = {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

function setMutation(overrides: Record<string, unknown> = {}) {
  const mutate = vi.fn();
  mockActionMutation.current = {
    mutate,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
  return mutate;
}

function renderPage(language: "en" | "es" = "en") {
  return renderWithI18n(<NotificationsInboxPage />, { language });
}

describe("NotificationsInboxPage", () => {
  beforeEach(() => {
    setQuery();
    setMutation();
    mockSubscribeLiveNotifications.mockReturnValue(vi.fn());
  });

  it("renders entries newest first with type, timestamp, stored text, and unread marker", async () => {
    const newest = entry({
      notificationId: "n2",
      notificationType: "Warning",
      content: { kind: "text", text: "Second\nline" },
      createdAt: "2026-03-27T11:45:00.000Z",
    });
    const older = entry({
      notificationId: "n1",
      notificationType: "Info",
      content: { kind: "text", text: "Older message" },
      createdAt: "2026-03-27T10:15:00.000Z",
      read: true,
    });
    setQuery({ data: { pages: [page([older, newest], { unreadCount: 1 })] } });

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Warning");
    expect(rows[0]).toHaveTextContent("Unread");
    expect(rows[0].textContent).toContain("Second\nline");
    expect(
      within(rows[0]).getByText(formatDateTime(newest.createdAt, "en")),
    ).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Info");
    expect(rows[1]).not.toHaveTextContent("Unread");
  });

  it("loads the next page while more entries exist", async () => {
    const fetchNextPage = vi.fn();
    setQuery({
      data: { pages: [page([entry()], { hasMore: true })] },
      hasNextPage: true,
      fetchNextPage,
    });
    const user = userEvent.setup();

    await renderPage();

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("renders the loading state", async () => {
    setQuery({ isLoading: true });

    await renderPage();

    expect(screen.getByText("Loading notifications…")).toBeInTheDocument();
    expect(screen.queryByText("No notifications")).not.toBeInTheDocument();
  });

  it("renders the empty state with a zero unread count", async () => {
    setQuery({ data: { pages: [page([], { unreadCount: 0 })] } });

    await renderPage();

    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.getByText("You have no messages yet.")).toBeInTheDocument();
    expect(screen.getByText("0 unread")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("renders localized copy for a failure without raw server text", async () => {
    const refetch = vi.fn();
    setQuery({
      isError: true,
      error: new ServiceRequestError({
        code: "notificationsFetch.internal",
        status: 500,
        serverMessage: "raw server details",
      }),
      refetch,
    });
    const user = userEvent.setup();

    await renderPage();

    expect(
      screen.getByText("Something went wrong on our side. Try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("raw server details")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders the page copy, type label, marker, and timestamp in Spanish", async () => {
    const warning = entry({ notificationType: "Warning" });
    setQuery({
      data: { pages: [page([warning], { hasMore: true })] },
      hasNextPage: true,
    });

    await renderPage("es");

    expect(
      screen.getByRole("heading", { level: 1, name: "Notificaciones" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 sin leer")).toBeInTheDocument();
    expect(screen.getByText("Aviso")).toBeInTheDocument();
    expect(screen.getByText("Sin leer")).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime(warning.createdAt, "es")),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cargar más" }),
    ).toBeInTheDocument();
  });

  it("renders template content in English and Spanish", async () => {
    const template = entry({
      content: {
        kind: "template",
        key: "notifications.templates.weeklyReportReady",
        params: { weekLabel: "2026-W12" },
      },
    });
    setQuery({ data: { pages: [page([template])] } });

    const english = await renderPage("en");
    expect(
      screen.getByText("Weekly business report for 2026-W12 is ready."),
    ).toBeInTheDocument();
    english.unmount();

    setQuery({ data: { pages: [page([template])] } });
    await renderPage("es");
    expect(
      screen.getByText(
        "El informe semanal del negocio para 2026-W12 está listo.",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to English when the active language has no translation", async () => {
    const i18n = await createTestI18n("es");
    i18n.removeResourceBundle("es", "common");
    setQuery({
      data: {
        pages: [
          page([
            entry({
              content: {
                kind: "template",
                key: "notifications.templates.weeklyReportReady",
                params: { weekLabel: "2026-W13" },
              },
            }),
          ]),
        ],
      },
    });

    await renderWithI18n(<NotificationsInboxPage />, { i18n });

    expect(
      await screen.findByText("Weekly business report for 2026-W13 is ready."),
    ).toBeInTheDocument();
  });

  it("renders literal text exactly as stored and never translates it", async () => {
    setQuery({
      data: {
        pages: [
          page([
            entry({
              content: { kind: "text", text: "Mensaje del usuario" },
            }),
          ]),
        ],
      },
    });

    await renderPage("es");

    expect(screen.getByText("Mensaje del usuario")).toBeInTheDocument();
  });

  it("renders the loading, empty, and error states in Spanish", async () => {
    setQuery({ isLoading: true });
    const loading = await renderPage("es");
    expect(
      screen.getByText("Cargando notificaciones…"),
    ).toBeInTheDocument();
    loading.unmount();

    setQuery({ data: { pages: [page([], { unreadCount: 0 })] } });
    const empty = await renderPage("es");
    expect(screen.getByText("No hay notificaciones")).toBeInTheDocument();
    expect(
      screen.getByText("Todavía no tienes mensajes."),
    ).toBeInTheDocument();
    expect(screen.getByText("0 sin leer")).toBeInTheDocument();
    empty.unmount();

    setQuery({
      isError: true,
      error: new ServiceRequestError({
        code: "notificationsFetch.internal",
        status: 500,
      }),
    });
    await renderPage("es");
    expect(
      screen.getByText("Algo salió mal por nuestra parte. Inténtalo de nuevo."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Intentar de nuevo" }),
    ).toBeInTheDocument();
  });

  it("marks an unread entry read when it is opened", async () => {
    const mutate = setMutation();
    setQuery({ data: { pages: [page([entry()])] } });
    const user = userEvent.setup();

    await renderPage();

    const row = screen.getByRole("listitem");
    await user.click(
      within(row).getByRole("button", {
        name: "Open notification: Your order is ready.",
      }),
    );

    expect(mutate).toHaveBeenCalledWith({
      type: "markRead",
      notificationId: "n1",
    });
  });

  it("marks an unread entry read with the explicit action", async () => {
    const mutate = setMutation();
    setQuery({ data: { pages: [page([entry()])] } });
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      screen.getByRole("button", {
        name: "Mark notification as read: Your order is ready.",
      }),
    );

    expect(mutate).toHaveBeenCalledWith({
      type: "markRead",
      notificationId: "n1",
    });
  });

  it("marks every visible entry read", async () => {
    const mutate = setMutation();
    setQuery({ data: { pages: [page([entry()])] } });
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      screen.getByRole("button", { name: "Mark all as read" }),
    );

    expect(mutate).toHaveBeenCalledWith({ type: "markAllRead" });
  });

  it("disables mark all when the unread count is zero", async () => {
    setQuery({
      data: {
        pages: [page([entry({ read: true })], { unreadCount: 0 })],
      },
    });

    await renderPage();

    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeDisabled();
  });

  it("disables every action while a mutation is pending", async () => {
    setMutation({ isPending: true });
    setQuery({ data: { pages: [page([entry()])] } });

    await renderPage();

    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Mark notification as read: Your order is ready.",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete notification: Your order is ready." }),
    ).toBeDisabled();
  });

  it("hides the entry from the caller's list", async () => {
    const mutate = setMutation();
    setQuery({ data: { pages: [page([entry()])] } });
    const user = userEvent.setup();

    await renderPage();

    await user.click(
      screen.getByRole("button", { name: "Delete notification: Your order is ready." }),
    );

    expect(mutate).toHaveBeenCalledWith({
      type: "hide",
      notificationId: "n1",
    });
  });

  it("renders localized mutation failure copy and keeps the entry", async () => {
    setMutation({
      isError: true,
      error: new ServiceRequestError({
        code: "notificationsDelete.internal",
        status: 500,
        serverMessage: "raw server details",
      }),
    });
    setQuery({ data: { pages: [page([entry()])] } });

    await renderPage();

    expect(
      screen.getByText("The notification could not be deleted. Try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("raw server details")).not.toBeInTheDocument();
    expect(screen.getByText("Your order is ready.")).toBeInTheDocument();
  });

  it("renders localized read failure copy", async () => {
    setMutation({
      isError: true,
      error: new ServiceRequestError({
        code: "notificationsRead.internal",
        status: 500,
      }),
    });
    setQuery({ data: { pages: [page([entry()])] } });

    await renderPage();

    expect(
      screen.getByText(
        "The notification could not be marked as read. Try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("renders Spanish action labels and mutation failure copy", async () => {
    setMutation({
      isError: true,
      error: new ServiceRequestError({
        code: "notificationsReadAll.internal",
        status: 500,
      }),
    });
    setQuery({ data: { pages: [page([entry({ notificationType: "Warning" })])] } });

    await renderPage("es");

    expect(
      screen.getByRole("button", { name: "Marcar todas como leídas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Marcar la notificación como leída: Your order is ready.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Eliminar la notificación: Your order is ready.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No se pudieron marcar las notificaciones como leídas. Inténtalo de nuevo.",
      ),
    ).toBeInTheDocument();
  });

  it("refreshes the inbox on a live notification event and unsubscribes on unmount", async () => {
    let listener: ((event: LiveNotificationEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    mockSubscribeLiveNotifications.mockImplementation(
      (handler: (event: LiveNotificationEvent) => void) => {
        listener = handler;
        return unsubscribe;
      },
    );
    const refetch = vi.fn().mockResolvedValue(undefined);
    setQuery({ data: { pages: [page([entry()])] }, refetch });

    const view = await renderPage();

    expect(mockSubscribeLiveNotifications).toHaveBeenCalledTimes(1);

    act(() => {
      listener?.({
        notificationId: "n2",
        businessId: "b1",
        content: { kind: "text", text: "Your order is ready." },
        notificationType: "Info",
        correlationId: "corr-2",
      });
    });

    expect(refetch).toHaveBeenCalledTimes(1);

    view.unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
