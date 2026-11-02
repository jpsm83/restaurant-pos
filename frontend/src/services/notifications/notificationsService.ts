/**
 * Notification inbox service — the signed-in User's own inbox read and actions.
 *
 * The endpoints are session-derived: no User id is sent, so the caller's session
 * selects the recipient. Network and React Query live here; failures use the
 * shared machine-code contract so pages never render raw server copy.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  INotificationInboxHideResponse,
  INotificationInboxReadResponse,
  INotificationInboxResponse,
  INotificationInboxUnreadCountResponse,
} from "restaurant-pos-packages/interfaces/INotification";
import { http } from "../http";
import { queryKeys } from "../queryKeys";
import { toServiceRequestError } from "../serviceErrors";

const INBOX_PATH = "/api/v1/notifications/inbox";

/** Reads one page of the caller's visible inbox entries. */
export async function fetchNotificationsInbox(
  page = 1,
  signal?: AbortSignal,
): Promise<INotificationInboxResponse> {
  try {
    const { data } = await http.get<INotificationInboxResponse>(
      `${INBOX_PATH}?page=${page}`,
      { signal },
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "notificationsFetch");
  }
}

/** Marks one entry in the caller's inbox read. */
export async function markNotificationRead(
  notificationId: string,
): Promise<INotificationInboxReadResponse> {
  try {
    const { data } = await http.patch<INotificationInboxReadResponse>(
      `${INBOX_PATH}/${notificationId}/read`,
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "notificationsRead");
  }
}

/** Marks every visible entry in the caller's inbox read. */
export async function markAllNotificationsRead(): Promise<INotificationInboxUnreadCountResponse> {
  try {
    const { data } = await http.patch<INotificationInboxUnreadCountResponse>(
      `${INBOX_PATH}/read-all`,
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "notificationsReadAll");
  }
}

/** Hides one entry from the caller's inbox only. */
export async function hideNotificationInboxEntry(
  notificationId: string,
): Promise<INotificationInboxHideResponse> {
  try {
    const { data } = await http.delete<INotificationInboxHideResponse>(
      `${INBOX_PATH}/${notificationId}`,
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "notificationsDelete");
  }
}

/** The three mutations the shared inbox page can perform. */
export type NotificationInboxAction =
  | { type: "markRead"; notificationId: string }
  | { type: "markAllRead" }
  | { type: "hide"; notificationId: string };

export async function applyNotificationInboxAction(
  action: NotificationInboxAction,
): Promise<void> {
  switch (action.type) {
    case "markRead":
      await markNotificationRead(action.notificationId);
      return;
    case "markAllRead":
      await markAllNotificationsRead();
      return;
    case "hide":
      await hideNotificationInboxEntry(action.notificationId);
      return;
  }
}

/**
 * Applies one inbox action and invalidates every inbox query on success.
 * Failures leave the cached inbox untouched so the page keeps its last list.
 */
export function useNotificationInboxActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: applyNotificationInboxAction,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.inboxAll(),
      }),
  });
}

/** Infinite inbox read; each page parameter is the server page number. */
export function useNotificationsInboxQuery(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: userId
      ? queryKeys.notifications.inbox(userId)
      : queryKeys.notifications.inboxPending(),
    queryFn: ({ pageParam, signal }) =>
      fetchNotificationsInbox(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: Boolean(userId),
  });
}
