import type { FastifyInstance } from "fastify";
import { onLiveInAppNotification } from "../channels/liveInAppEvents.ts";
import liveInAppChannel from "../channels/liveInAppChannel.ts";
import liveConnectionRegistry from "./connectionRegistry.ts";

const isLiveInAppEnabled = (): boolean =>
  process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED !== "false";

export const registerLiveInAppBridge = (app: FastifyInstance): void => {
  const unsubscribe = onLiveInAppNotification(async (payload) => {
    if (!isLiveInAppEnabled()) return;

    const result = await liveInAppChannel.send(payload, app.log);
    if (!result.success) {
      app.log.warn({
        scope: "communications.live.push",
        outcome: "failed",
        eventName: payload.eventName ?? "UNKNOWN",
        businessId: payload.businessId.toString(),
        correlationId: payload.correlationId,
        error: result.error ?? "unknown",
      });
      return;
    }

    const liveMetrics = liveConnectionRegistry.getLiveMetrics();
    app.log.info({
      scope: "communications.live.push",
      outcome: "success",
      eventName: payload.eventName ?? "UNKNOWN",
      businessId: payload.businessId.toString(),
      correlationId: payload.correlationId,
      deliveredSockets: result.sentCount ?? 0,
      connectedUsers: liveMetrics.connectedUsers,
      connectedSockets: liveMetrics.connectedSockets,
    });
  });

  // Ensure test/server shutdown does not leak global EventEmitter listeners.
  app.addHook("onClose", async () => {
    unsubscribe();
  });
};

