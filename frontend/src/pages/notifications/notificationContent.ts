import type { TFunction } from "i18next";
import type { NotificationContent } from "restaurant-pos-packages/interfaces/INotification";
import type { LocaleFormatters } from "@/hooks/useFormatting";

const readString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const readRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const listFormat = (formatting: LocaleFormatters) =>
  new Intl.ListFormat(formatting.language, {
    style: "long",
    type: "conjunction",
  });

const formatDeliveryAddress = (value: unknown): string => {
  const address = readRecord(value);
  const cityLine = [address.city, address.state, address.postalCode]
    .map(readString)
    .filter(Boolean)
    .join(" ");
  return [address.street, cityLine, address.country]
    .map(readString)
    .filter(Boolean)
    .join(", ");
};

const MAX_PROFILE_FIELDS = 5;

/**
 * Render stored notification content in the active UI language.
 *
 * Literal text is returned exactly as stored. A template key is resolved
 * through i18next (English fallback comes from i18next's configured fallback
 * language), with the parameters formatted for the active locale.
 */
export function renderNotificationContent(
  content: NotificationContent,
  t: TFunction,
  formatting: LocaleFormatters,
): string {
  if (content.kind === "text") return content.text;

  const params = content.params;

  switch (content.key) {
    case "notifications.templates.orderConfirmed": {
      const orderCount = readNumber(params.orderCount) ?? 0;
      const totalAmount = readNumber(params.totalAmount);
      const lines = [
        t(content.key, {
          count: orderCount,
          reference: readString(params.reference),
          total:
            totalAmount === undefined
              ? ""
              : formatting.formatCurrency(
                  totalAmount,
                  readString(params.currency) || null,
                ),
        }) as string,
      ];

      const flow = readString(params.flow);
      const flowLabel =
        flow === "delivery"
          ? (t("notifications.templates.orderConfirmedFlowDelivery") as string)
          : flow === "selfOrder"
            ? (t("notifications.templates.orderConfirmedFlowSelfOrder") as string)
            : (t("notifications.templates.orderConfirmedFlowOrder") as string);
      lines.push(
        t("notifications.templates.orderConfirmedFlow", {
          flowLabel,
        }) as string,
      );

      const clientName = readString(params.clientName);
      if (clientName) {
        lines.push(
          t("notifications.templates.orderConfirmedCustomer", {
            clientName,
          }) as string,
        );
      }

      const deliveryAddress = formatDeliveryAddress(params.deliveryAddress);
      if (deliveryAddress) {
        lines.push(
          t("notifications.templates.orderConfirmedAddress", {
            deliveryAddress,
          }) as string,
        );
      }

      return lines.join("\n");
    }
    case "notifications.templates.reservationPending":
    case "notifications.templates.reservationPendingManager":
    case "notifications.templates.reservationConfirmed":
    case "notifications.templates.reservationCancelled": {
      const lines = [
        t(content.key, {
          reference: readString(params.reference),
          guestCount: readNumber(params.guestCount) ?? 0,
          when: formatting.formatDateTime(readString(params.reservationStart)),
        }) as string,
      ];
      const description = readString(params.description);
      if (description) {
        lines.push(
          t("notifications.templates.reservationReason", {
            description,
          }) as string,
        );
      }
      return lines.join("\n");
    }
    case "notifications.templates.lowStock": {
      const items = Array.isArray(params.items) ? params.items : [];
      if (items.length === 0) {
        return t("notifications.templates.lowStockEmpty") as string;
      }
      const details = listFormat(formatting).format(
        items.map((item) => {
          const record = readRecord(item);
          const currentCount = readNumber(record.currentCount) ?? 0;
          const threshold = readNumber(record.threshold) ?? 0;
          return `${readString(record.name)} (${formatting.formatNumber(
            currentCount,
          )}/${formatting.formatNumber(threshold)})`;
        }),
      );
      return t(content.key, { details }) as string;
    }
    case "notifications.templates.monthlyReportReady":
      return t(content.key, {
        monthLabel: readString(params.monthLabel),
      }) as string;
    case "notifications.templates.weeklyReportReady":
      return t(content.key, {
        weekLabel: readString(params.weekLabel),
      }) as string;
    case "notifications.templates.businessProfileUpdated": {
      const actor = readRecord(params.actor);
      const actorEmail = readString(actor.email);
      const actorRole = readString(actor.role);
      const actorLabel =
        actor.source === "system"
          ? (t("notifications.templates.businessProfileUpdatedActorSystem") as string)
          : listFormat(formatting).format(
              [actorRole, actorEmail].filter(Boolean),
            ) ||
            (t("notifications.templates.businessProfileUpdatedActorMember") as string);
      const fields = Array.isArray(params.fields)
        ? params.fields.filter(
            (field): field is string =>
              typeof field === "string" && field.trim().length > 0,
          )
        : [];
      const shownFields = fields.slice(0, MAX_PROFILE_FIELDS);
      const main =
        fields.length === 0
          ? (t("notifications.templates.businessProfileUpdatedNoFields", {
              actor: actorLabel,
            }) as string)
          : (t(content.key, {
              actor: actorLabel,
              fields: listFormat(formatting).format(shownFields),
            }) as string);
      const lines = [main];
      if (fields.length > MAX_PROFILE_FIELDS) {
        lines.push(
          t("notifications.templates.businessProfileUpdatedMore", {
            count: fields.length - MAX_PROFILE_FIELDS,
          }) as string,
        );
      }
      const sensitiveCount = readNumber(params.sensitiveFieldCount) ?? 0;
      if (sensitiveCount > 0) {
        lines.push(
          t("notifications.templates.businessProfileUpdatedSensitive", {
            count: sensitiveCount,
          }) as string,
        );
      }
      return lines.join("\n");
    }
  }
}
