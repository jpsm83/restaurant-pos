/**
 * Shared notification inbox page.
 *
 * Reads and mutates the session-derived self endpoints; no User id appears in
 * the URL. The page is layout-agnostic so the Customer account area and the
 * Business shell can both render it. It refreshes on live notification events
 * while mounted.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { notificationEnums } from "restaurant-pos-packages/enums";
import type { INotificationInboxItem } from "restaurant-pos-packages/interfaces/INotification";
import { useAuth } from "@/auth/store/AuthContext";
import {
  NotificationTypeBadge,
  type NotificationTypeTone,
} from "@/components/ui-kit/NotificationTypeBadge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatting } from "@/hooks/useFormatting";
import { useErrorMessage } from "@/i18n/errorCopy";
import { subscribeLiveNotifications } from "@/live/connection";
import {
  useNotificationInboxActionMutation,
  useNotificationsInboxQuery,
  type NotificationInboxAction,
} from "@/services/notifications/notificationsService";
import {
  ServiceRequestError,
  type ServiceFailure,
} from "@/services/serviceErrors";
import { renderNotificationContent } from "./notificationContent";

const KNOWN_NOTIFICATION_TYPES = new Set(notificationEnums);

function typePresentation(notificationType: string): {
  labelKey: string;
  tone: NotificationTypeTone;
} {
  const knownType = KNOWN_NOTIFICATION_TYPES.has(notificationType)
    ? notificationType
    : "Info";

  return {
    labelKey: `notifications.types.${knownType.toLowerCase()}`,
    tone:
      knownType === "Warning"
        ? "warning"
        : knownType === "Emergency"
          ? "danger"
          : "neutral",
  };
}

function InboxEntry({
  entry,
  pending,
  onAction,
}: {
  entry: INotificationInboxItem;
  pending: boolean;
  onAction: (action: NotificationInboxAction) => void;
}) {
  const { t } = useTranslation("common");
  const formatting = useFormatting();
  const { labelKey, tone } = typePresentation(entry.notificationType);
  const renderedContent = renderNotificationContent(entry.content, t, formatting);
  const markRead = () =>
    onAction({ type: "markRead", notificationId: entry.notificationId });

  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <NotificationTypeBadge tone={tone}>
          {t(labelKey)}
        </NotificationTypeBadge>
        {entry.read ? null : (
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {t("notifications.unreadMarker")}
          </span>
        )}
        <time
          className="ml-auto text-xs text-muted-foreground"
          dateTime={entry.createdAt}
        >
          {formatting.formatDateTime(entry.createdAt)}
        </time>
      </div>
      {entry.read ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
          {renderedContent}
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          aria-label={t("notifications.actions.openNotificationLabel", {
            message: renderedContent,
          })}
          onClick={markRead}
          className="mt-2 block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
        >
          <span className="block whitespace-pre-wrap break-words text-sm text-foreground">
            {renderedContent}
          </span>
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {entry.read ? null : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            aria-label={t("notifications.actions.markReadAriaLabel", {
              message: renderedContent,
            })}
            onClick={markRead}
          >
            {t("notifications.actions.markRead")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending}
          aria-label={t("notifications.actions.deleteAriaLabel", {
            message: renderedContent,
          })}
          onClick={() =>
            onAction({ type: "hide", notificationId: entry.notificationId })
          }
        >
          {t("notifications.actions.delete")}
        </Button>
      </div>
    </li>
  );
}

/** Shared inbox read surface. */
export default function NotificationsInboxPage() {
  const { t } = useTranslation("common");
  const resolveError = useErrorMessage();
  const { state } = useAuth();
  const userId = state.status === "authenticated" ? state.user?.id : undefined;
  const inboxQuery = useNotificationsInboxQuery(userId);
  const actionMutation = useNotificationInboxActionMutation();

  const pages = inboxQuery.data?.pages ?? [];
  const entries = pages
    .flatMap((page) => page.items)
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.notificationId.localeCompare(left.notificationId),
    );
  const unreadCount = pages[0]?.unreadCount ?? 0;
  const isMutating = actionMutation.isPending;
  const failure =
    inboxQuery.error instanceof ServiceRequestError ? inboxQuery.error : null;
  const fallbackCode =
    actionMutation.variables?.type === "markAllRead"
      ? "notificationsReadAll.transport"
      : actionMutation.variables?.type === "hide"
        ? "notificationsDelete.transport"
        : "notificationsRead.transport";
  const actionFailure: ServiceFailure | null = actionMutation.isError
    ? actionMutation.error instanceof ServiceRequestError
      ? actionMutation.error
      : { code: fallbackCode }
    : null;

  const refetchInbox = inboxQuery.refetch;
  useEffect(
    () =>
      subscribeLiveNotifications(() => {
        void refetchInbox();
      }),
    [refetchInbox],
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-xl font-semibold text-foreground">
            {t("notifications.title")}
          </h1>
          {inboxQuery.data ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("notifications.unreadCount", { count: unreadCount })}
            </p>
          ) : null}
        </div>
        {inboxQuery.data ? (
          <Button
            type="button"
            variant="outline"
            disabled={unreadCount === 0 || isMutating}
            onClick={() => actionMutation.mutate({ type: "markAllRead" })}
          >
            {t("notifications.actions.markAllRead")}
          </Button>
        ) : null}
      </div>

      {actionFailure ? (
        <Alert className="mt-4 max-w-3xl">{resolveError(actionFailure)}</Alert>
      ) : null}

      {inboxQuery.isLoading ? (
        <div className="mt-6 max-w-3xl space-y-3" aria-busy="true">
          <span className="sr-only">{t("notifications.loading")}</span>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : inboxQuery.isError ? (
        <div className="mt-6 max-w-3xl space-y-3">
          <Alert>
            {resolveError(failure ?? { code: "notificationsFetch.transport" })}
          </Alert>
          <Button variant="outline" onClick={() => void inboxQuery.refetch()}>
            {t("notifications.retry")}
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <Card className="mt-6 w-full max-w-3xl">
          <CardHeader>
            <CardTitle>{t("notifications.empty.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("notifications.empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="mt-6 max-w-3xl space-y-3">
            {entries.map((entry) => (
              <InboxEntry
                key={entry.notificationId}
                entry={entry}
                pending={isMutating}
                onAction={actionMutation.mutate}
              />
            ))}
          </ul>
          {inboxQuery.hasNextPage ? (
            <div className="mt-4 max-w-3xl">
              <Button
                variant="outline"
                disabled={inboxQuery.isFetchingNextPage}
                onClick={() => void inboxQuery.fetchNextPage()}
              >
                {inboxQuery.isFetchingNextPage
                  ? t("notifications.loadingMore")
                  : t("notifications.loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
