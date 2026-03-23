import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";

import liveConnectionRegistry from "../../communications/live/connectionRegistry.ts";
import type { AuthSession } from "../../auth/types.ts";

const LOG_PREFIX = "[communications][notificationsLiveRoute]";

const isLiveInAppEnabled = (): boolean =>
  process.env.COMMUNICATIONS_INAPP_LIVE_ENABLED !== "false";

const parseBearerToken = (authorization?: string): string | null => {
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
};

export const notificationsLiveRoutes: FastifyPluginAsync = async (app) => {
  if (!isLiveInAppEnabled()) {
    app.log.info(
      `${LOG_PREFIX} Live in-app notifications disabled by COMMUNICATIONS_INAPP_LIVE_ENABLED`
    );
    return;
  }

  liveConnectionRegistry.startHeartbeat(app.log);

  app.get(
    "/live",
    { websocket: true },
    (socket, req) => {
      const correlationId = req.id;
      const token = parseBearerToken(req.headers.authorization);
      if (!token) {
        liveConnectionRegistry.markAuthFailure();
        app.log.warn({
          scope: "communications.live.auth",
          outcome: "failed",
          reason: "missing_bearer_token",
          correlationId,
        });
        socket.close(1008, "Unauthorized");
        return;
      }

      let session: AuthSession;
      try {
        session = app.jwt.verify<AuthSession>(token);
      } catch {
        liveConnectionRegistry.markAuthFailure();
        app.log.warn({
          scope: "communications.live.auth",
          outcome: "failed",
          reason: "invalid_token",
          correlationId,
        });
        socket.close(1008, "Unauthorized");
        return;
      }

      if (session.type !== "user") {
        liveConnectionRegistry.markAuthFailure();
        app.log.warn({
          scope: "communications.live.auth",
          outcome: "failed",
          reason: "non_user_session",
          correlationId,
        });
        socket.close(1008, "Forbidden");
        return;
      }

      const userId = new Types.ObjectId(session.id);
      liveConnectionRegistry.registerSocket(userId, socket);

      const metrics = liveConnectionRegistry.getLiveMetrics();
      app.log.info({
        scope: "communications.live.connection",
        outcome: "connected",
        userId: userId.toString(),
        connectedUsers: metrics.connectedUsers,
        connectedSockets: metrics.connectedSockets,
        correlationId,
      });

      socket.send(
        JSON.stringify({
          type: "notification.live.connected",
          data: { userId: userId.toString() },
        })
      );
    }
  );
};

