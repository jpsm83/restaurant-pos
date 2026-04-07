import { EventEmitter } from "node:events";
import type { LiveInAppNotificationEvent } from "../types.ts";

const LIVE_EVENT_NAME = "notification.persisted";

const liveInAppEvents = new EventEmitter();

export const emitLiveInAppNotification = (
  payload: LiveInAppNotificationEvent
): void => {
  liveInAppEvents.emit(LIVE_EVENT_NAME, payload);
};

export const onLiveInAppNotification = (
  listener: (payload: LiveInAppNotificationEvent) => void
): (() => void) => {
  liveInAppEvents.on(LIVE_EVENT_NAME, listener);
  // Return unsubscribe so server/test lifecycles can remove listeners on close.
  return () => {
    liveInAppEvents.off(LIVE_EVENT_NAME, listener);
  };
};

export default liveInAppEvents;

