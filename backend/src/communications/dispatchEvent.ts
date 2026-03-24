import { Types } from "mongoose";
import User from "../models/user.ts";
import emailChannel from "./channels/emailChannel.ts";
import inAppChannel from "./channels/inAppChannel.ts";
import buildOrderReceiptTemplate from "./templates/orderReceiptTemplate.ts";
import buildReservationTemplate from "./templates/reservationTemplate.ts";
import buildLowStockTemplate from "./templates/lowStockTemplate.ts";
import {
  buildMonthlyReportReadyTemplate,
  buildWeeklyReportReadyTemplate,
} from "./templates/reportReadyTemplate.ts";
import { resolveManagersByPolicy } from "./recipientResolvers/managerRecipientPolicy.ts";
import type {
  CommunicationsChannel,
  CommunicationsChannelResult,
  CommunicationsDispatchOptions,
  CommunicationsDispatchResult,
  CommunicationsEventName,
  CommunicationsEventPayload,
  CommunicationsEventPayloadMap,
  NotificationType,
} from "./types.ts";
import {
  recordChannelResult,
  recordDispatchAttempt,
  recordDispatchResult,
} from "./observability/metrics.ts";

const LOG_PREFIX = "[communications][dispatchEvent]";
const DISPATCH_SCOPE = "communications.dispatch";
const DEFAULT_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;
const recentDispatches = new Map<string, number>();

const createCorrelationId = (): string =>
  `comm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getIdempotencyWindowMs = (windowOverride?: number): number => {
  if (typeof windowOverride === "number" && Number.isFinite(windowOverride)) {
    return Math.max(1_000, Math.floor(windowOverride));
  }
  const raw = Number(
    process.env.COMMUNICATIONS_IDEMPOTENCY_WINDOW_MS ?? DEFAULT_IDEMPOTENCY_WINDOW_MS
  );
  if (!Number.isFinite(raw)) return DEFAULT_IDEMPOTENCY_WINDOW_MS;
  return Math.max(1_000, Math.floor(raw));
};

const cleanupExpiredIdempotencyEntries = (now: number, windowMs: number): void => {
  recentDispatches.forEach((timestamp, key) => {
    if (now - timestamp > windowMs) {
      recentDispatches.delete(key);
    }
  });
};

const isChannelEnabled = (channel: CommunicationsChannel): boolean => {
  if (channel === "email") {
    return process.env.COMMUNICATIONS_EMAIL_ENABLED !== "false";
  }
  if (channel === "inApp") {
    return process.env.COMMUNICATIONS_INAPP_ENABLED !== "false";
  }
  return process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED !== "false";
};

const getUserEmail = async (userId: Types.ObjectId): Promise<string | null> => {
  const user = (await User.findById(userId)
    .select("personalDetails.email")
    .lean()) as { personalDetails?: { email?: string } } | null;

  return user?.personalDetails?.email?.trim() || null;
};

const shouldUseChannel = (
  channel: CommunicationsChannel,
  options?: CommunicationsDispatchOptions
): boolean => {
  if (!isChannelEnabled(channel)) return false;
  if (!options?.preferredChannels?.length) return true;
  return options.preferredChannels.includes(channel);
};

const appendResult = (
  results: CommunicationsChannelResult[],
  result: CommunicationsChannelResult
) => {
  results.push(result);
};

interface DispatchContext {
  eventName: CommunicationsEventName;
  options?: CommunicationsDispatchOptions;
  correlationId: string;
  fireAndForget: boolean;
  businessId?: Types.ObjectId;
  channelResults: CommunicationsChannelResult[];
  safeInAppSend: (input: {
    message: string;
    notificationType?: NotificationType;
    businessId: Types.ObjectId;
    recipients: {
      customerUserIds?: Types.ObjectId[];
      employeeIds?: Types.ObjectId[];
      employeeUserIds?: Types.ObjectId[];
    };
  }) => Promise<void>;
  safeEmailSend: (input: {
    to: string | string[];
    subject: string;
    text: string;
    businessId: Types.ObjectId;
  }) => Promise<void>;
}

type EventHandler<E extends CommunicationsEventName> = (
  payload: CommunicationsEventPayloadMap[E],
  ctx: DispatchContext
) => Promise<void>;

const handleOrderConfirmed: EventHandler<"ORDER_CONFIRMED"> = async (p, ctx) => {
  const message = buildOrderReceiptTemplate(p);
  const email = await getUserEmail(p.userId);

  if (email) {
    await ctx.safeEmailSend({
      to: email,
      subject: `Order confirmation - Ref ${p.orderCode ?? String(p.dailyReferenceNumber)}`,
      text: message,
      businessId: p.businessId,
    });
  }

  await ctx.safeInAppSend({
    message,
    notificationType: "Info",
    businessId: p.businessId,
    recipients: { customerUserIds: [p.userId] },
  });
};

const handleReservationPending: EventHandler<"RESERVATION_PENDING"> = async (
  p,
  ctx
) => {
  const baseMessage = buildReservationTemplate({
    reservationId: p.reservationId,
    status: "Pending",
    reservationStart: p.reservationStart,
    guestCount: p.guestCount,
    description: p.description,
  });
  const email = await getUserEmail(p.userId);

  if (email) {
    await ctx.safeEmailSend({
      to: email,
      subject: `Reservation request received - Ref ${p.reservationId.toString()}`,
      text: baseMessage,
      businessId: p.businessId,
    });
  }

  await ctx.safeInAppSend({
    message: `${baseMessage}\n\nYour reservation is pending approval.`,
    notificationType: "Info",
    businessId: p.businessId,
    recipients: { customerUserIds: [p.userId] },
  });

  const managers = await resolveManagersByPolicy({
    businessId: p.businessId,
    eventName: ctx.eventName,
  });

  if (managers.employeeIds.length > 0) {
    await ctx.safeInAppSend({
      message: `${baseMessage}\n\nAction required: approve or reject this reservation.`,
      notificationType: "Info",
      businessId: p.businessId,
      recipients: { employeeIds: managers.employeeIds },
    });
  }
};

const handleReservationDecided: EventHandler<"RESERVATION_DECIDED"> = async (
  p,
  ctx
) => {
  const message = buildReservationTemplate({
    reservationId: p.reservationId,
    status: p.status,
    reservationStart: p.reservationStart,
    guestCount: p.guestCount,
    description: p.description,
  });
  const email = await getUserEmail(p.userId);

  if (email) {
    await ctx.safeEmailSend({
      to: email,
      subject: `Reservation ${p.status.toLowerCase()} - Ref ${p.reservationId.toString()}`,
      text: message,
      businessId: p.businessId,
    });
  }

  await ctx.safeInAppSend({
    message,
    notificationType: "Info",
    businessId: p.businessId,
    recipients: { customerUserIds: [p.userId] },
  });
};

const handleLowStockAlert: EventHandler<"LOW_STOCK_ALERT"> = async (p, ctx) => {
  const message = buildLowStockTemplate(
    p.lowStockItems.map((item) => ({
      name: item.name,
      currentCount: item.currentCount,
      threshold: item.threshold,
    }))
  );

  const managers = await resolveManagersByPolicy({
    businessId: p.businessId,
    eventName: ctx.eventName,
  });

  if (managers.employeeIds.length > 0) {
    await ctx.safeInAppSend({
      message,
      notificationType: "Warning",
      businessId: p.businessId,
      recipients: { employeeIds: managers.employeeIds },
    });
  }
};

const handleMonthlyReportReady: EventHandler<"MONTHLY_REPORT_READY"> = async (
  p,
  ctx
) => {
  const message = buildMonthlyReportReadyTemplate(p.monthLabel);
  const managers = await resolveManagersByPolicy({
    businessId: p.businessId,
    eventName: ctx.eventName,
  });

  if (managers.employeeIds.length > 0) {
    await ctx.safeInAppSend({
      message,
      notificationType: "Info",
      businessId: p.businessId,
      recipients: { employeeIds: managers.employeeIds },
    });
  }
};

const handleWeeklyReportReady: EventHandler<"WEEKLY_REPORT_READY"> = async (
  p,
  ctx
) => {
  const message = buildWeeklyReportReadyTemplate(p.weekLabel);
  const managers = await resolveManagersByPolicy({
    businessId: p.businessId,
    eventName: ctx.eventName,
  });

  if (managers.employeeIds.length > 0) {
    await ctx.safeInAppSend({
      message,
      notificationType: "Info",
      businessId: p.businessId,
      recipients: { employeeIds: managers.employeeIds },
    });
  }
};

const eventHandlers: {
  [K in CommunicationsEventName]: EventHandler<K>;
} = {
  ORDER_CONFIRMED: handleOrderConfirmed,
  RESERVATION_PENDING: handleReservationPending,
  RESERVATION_DECIDED: handleReservationDecided,
  LOW_STOCK_ALERT: handleLowStockAlert,
  MONTHLY_REPORT_READY: handleMonthlyReportReady,
  WEEKLY_REPORT_READY: handleWeeklyReportReady,
};

export const dispatchEvent = async <E extends CommunicationsEventName>(
  eventName: E,
  payload: CommunicationsEventPayload<E>,
  options?: CommunicationsDispatchOptions
): Promise<CommunicationsDispatchResult> => {
  const correlationId = options?.correlationId ?? createCorrelationId();
  const fireAndForget = options?.fireAndForget ?? true;
  const channelResults: CommunicationsChannelResult[] = [];
  const businessId = (payload as { businessId?: Types.ObjectId })?.businessId;
  const idempotencyWindowMs = getIdempotencyWindowMs(options?.idempotencyWindowMs);
  const rawIdempotencyKey = options?.idempotencyKey?.trim();
  const idempotencyKey =
    rawIdempotencyKey && rawIdempotencyKey.length > 0
      ? `${eventName}::${businessId?.toString() ?? "N/A"}::${rawIdempotencyKey}`
      : null;

  recordDispatchAttempt(eventName);
  console.info({
    scope: DISPATCH_SCOPE,
    stage: "attempt",
    eventName,
    correlationId,
    fireAndForget,
    businessId: businessId?.toString(),
    idempotencyKey: idempotencyKey ?? undefined,
  });

  if (idempotencyKey) {
    const now = Date.now();
    cleanupExpiredIdempotencyEntries(now, idempotencyWindowMs);
    const lastRunAt = recentDispatches.get(idempotencyKey);
    if (lastRunAt && now - lastRunAt < idempotencyWindowMs) {
      console.info({
        scope: DISPATCH_SCOPE,
        stage: "idempotency_skipped",
        eventName,
        correlationId,
        idempotencyKey,
        idempotencyWindowMs,
        businessId: businessId?.toString(),
      });
      return {
        eventName,
        success: true,
        channels: [],
        correlationId,
      };
    }
    recentDispatches.set(idempotencyKey, now);
  }

  const safeInAppSend = async (input: {
    message: string;
    notificationType?: NotificationType;
    businessId: Types.ObjectId;
    recipients: {
      customerUserIds?: Types.ObjectId[];
      employeeIds?: Types.ObjectId[];
      employeeUserIds?: Types.ObjectId[];
    };
  }) => {
    if (!shouldUseChannel("inApp", options)) return;
    const result = await inAppChannel.send({
      ...input,
      eventName,
      correlationId,
      fireAndForget,
    });
    appendResult(channelResults, result);
    recordChannelResult(eventName, result.channel, result.success);
    console.info({
      scope: DISPATCH_SCOPE,
      stage: "channel_result",
      eventName,
      correlationId,
      channel: result.channel,
      success: result.success,
      sentCount: result.sentCount ?? 0,
      error: result.error,
      businessId: businessId?.toString(),
    });
  };

  const safeEmailSend = async (input: {
    to: string | string[];
    subject: string;
    text: string;
    businessId: Types.ObjectId;
  }) => {
    if (!shouldUseChannel("email", options)) return;
    const result = await emailChannel.send({
      ...input,
      eventName,
      correlationId,
      fireAndForget,
    });
    appendResult(channelResults, result);
    recordChannelResult(eventName, result.channel, result.success);
    console.info({
      scope: DISPATCH_SCOPE,
      stage: "channel_result",
      eventName,
      correlationId,
      channel: result.channel,
      success: result.success,
      sentCount: result.sentCount ?? 0,
      error: result.error,
      businessId: businessId?.toString(),
    });
  };

  const handler = eventHandlers[eventName];
  if (!handler) {
    throw new Error(`${LOG_PREFIX} Unsupported event handler for ${eventName}`);
  }
  await handler(payload as CommunicationsEventPayloadMap[E], {
    eventName,
    options,
    correlationId,
    fireAndForget,
    businessId,
    channelResults,
    safeInAppSend,
    safeEmailSend,
  });

  const success = channelResults.length === 0 || channelResults.every((r) => r.success);
  recordDispatchResult(eventName, success);

  const result: CommunicationsDispatchResult = {
    eventName,
    success,
    channels: channelResults,
    correlationId,
  };

  console.info({
    scope: DISPATCH_SCOPE,
    stage: "result",
    eventName,
    correlationId,
    success,
    channelCount: channelResults.length,
    businessId: businessId?.toString(),
  });

  if (!success && !fireAndForget) {
    const failures = channelResults
      .filter((entry) => !entry.success)
      .map((entry) => `${entry.channel}: ${entry.error ?? "unknown error"}`)
      .join(" | ");
    console.warn({
      scope: DISPATCH_SCOPE,
      stage: "failure_replay_policy",
      eventName,
      correlationId,
      persistFailedDispatch: false,
      replayQueueStatus: "not_enabled_initial_version",
      businessId: businessId?.toString(),
    });
    throw new Error(`${LOG_PREFIX} Dispatch failed for ${eventName}: ${failures}`);
  }

  return result;
};

export default dispatchEvent;

