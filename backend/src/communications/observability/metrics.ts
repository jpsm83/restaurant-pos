import type { CommunicationsChannel, CommunicationsEventName } from "../types.ts";

type CounterMap = Record<string, number>;

const dispatchAttemptsByEvent: CounterMap = {};
const dispatchSuccessByEvent: CounterMap = {};
const dispatchFailureByEvent: CounterMap = {};
const channelSuccessByEvent: CounterMap = {};
const channelFailureByEvent: CounterMap = {};

let livePushedEvents = 0;
let liveDeliveredSockets = 0;
let liveDroppedPushes = 0;
let liveAuthFailures = 0;
const liveDroppedPushesByReason: CounterMap = {};
const liveAuthFailuresByReason: CounterMap = {};

const increment = (bag: CounterMap, key: string, delta = 1): void => {
  bag[key] = (bag[key] ?? 0) + delta;
};

export const recordDispatchAttempt = (eventName: CommunicationsEventName): void => {
  increment(dispatchAttemptsByEvent, eventName);
};

export const recordDispatchResult = (
  eventName: CommunicationsEventName,
  success: boolean,
): void => {
  if (success) {
    increment(dispatchSuccessByEvent, eventName);
    return;
  }
  increment(dispatchFailureByEvent, eventName);
};

export const recordChannelResult = (
  eventName: CommunicationsEventName,
  channel: CommunicationsChannel,
  success: boolean,
): void => {
  const key = `${eventName}::${channel}`;
  if (success) {
    increment(channelSuccessByEvent, key);
    return;
  }
  increment(channelFailureByEvent, key);
};

export const recordLivePushMetrics = (input: {
  deliveredSockets: number;
  droppedPushes: number;
  droppedByReason?: {
    offlineRecipient?: number;
    socketSendFailure?: number;
  };
}): void => {
  livePushedEvents += 1;
  liveDeliveredSockets += input.deliveredSockets;
  liveDroppedPushes += input.droppedPushes;
  if ((input.droppedByReason?.offlineRecipient ?? 0) > 0) {
    increment(
      liveDroppedPushesByReason,
      "offline_recipient",
      input.droppedByReason?.offlineRecipient
    );
  }
  if ((input.droppedByReason?.socketSendFailure ?? 0) > 0) {
    increment(
      liveDroppedPushesByReason,
      "socket_send_failure",
      input.droppedByReason?.socketSendFailure
    );
  }
};

export const recordLiveAuthFailure = (
  reason: "missing_bearer_token" | "invalid_token" | "non_user_session"
): void => {
  liveAuthFailures += 1;
  increment(liveAuthFailuresByReason, reason);
};

export const getCommunicationsMetricsSnapshot = () => ({
  dispatchAttemptsByEvent: { ...dispatchAttemptsByEvent },
  dispatchSuccessByEvent: { ...dispatchSuccessByEvent },
  dispatchFailureByEvent: { ...dispatchFailureByEvent },
  channelSuccessByEvent: { ...channelSuccessByEvent },
  channelFailureByEvent: { ...channelFailureByEvent },
  live: {
    pushedEvents: livePushedEvents,
    deliveredSockets: liveDeliveredSockets,
    droppedPushes: liveDroppedPushes,
    droppedPushesByReason: { ...liveDroppedPushesByReason },
    authFailures: liveAuthFailures,
    authFailuresByReason: { ...liveAuthFailuresByReason },
  },
});
