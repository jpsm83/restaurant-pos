/**
 * Notification inbox service — the signed-in User's own inbox read.
 *
 * The endpoint is session-derived: no User id is sent, so the caller's session
 * selects the recipient. Network and React Query live here; failures use the
 * shared machine-code contract so pages never render raw server copy.
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import type { INotificationInboxResponse } from "restaurant-pos-packages/interfaces/INotification";
import { http } from "../http";
import { queryKeys } from "../queryKeys";
import { toServiceRequestError } from "../serviceErrors";

/** Reads one page of the caller's visible inbox entries. */
export async function fetchNotificationsInbox(
  page = 1,
  signal?: AbortSignal,
): Promise<INotificationInboxResponse> {
  try {
    const { data } = await http.get<INotificationInboxResponse>(
      `/api/v1/notifications/inbox?page=${page}`,
      { signal },
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "notificationsFetch");
  }
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
