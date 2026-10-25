import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";

import liveConnectionRegistry from "../../communications/live/connectionRegistry.ts";
import { toLiveConnectedMessage } from "../../communications/live/contracts.ts";
import {
  assertAccessTokenRefreshSessionLive,
  isRejectedCredential,
} from "../../auth/middleware.ts";
import type { AuthSession } from "../../auth/types.ts";

const parseBearerToken = (authorization?: string): string | null => {
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
};

const parseTokenFromQuery = (url?: string): string | null => {
  if (!url || !url.includes("?")) return null;
  const query = url.slice(url.indexOf("?") + 1);
  const params = new URLSearchParams(query);
  const token = params.get("access_token")?.trim();
  return token && token.length > 0 ? token : null;
};

export const notificationsLiveRoutes: FastifyPluginAsync = async (app) => {
  // Route boundary:
  // - Connection/authentication/registry concerns only.
  // - Live notification push is switched in the bridge, not here.
  // - No notification persistence or fanout writes occur here.
  liveConnectionRegistry.startHeartbeat(app.log);

  app.get(
    "/live",
    { websocket: true },
    (socket, req) => {
      const correlationId = req.id;
      const token =
        parseBearerToken(req.headers.authorization) ?? parseTokenFromQuery(req.url);
      if (!token) {
        liveConnectionRegistry.markAuthFailure("missing_bearer_token");
        app.log.warn({
          scope: "communications.live.auth",
          outcome: "failed",
          reason: "missing_bearer_token",
          correlationId,
        });
        socket.close(1008, "Unauthorized");
        return;
      }

      void (async () => {
        let session: AuthSession & { sessionId?: string };
        try {
          session = app.jwt.verify<AuthSession & { sessionId?: string }>(token);
          await assertAccessTokenRefreshSessionLive(session);
        } catch (error) {
          if (!isRejectedCredential(error)) {
            app.log.error({
              scope: "communications.live.auth",
              outcome: "failed",
              correlationId,
              err: error,
            });
            socket.close(1011, "Internal error");
            return;
          }
          liveConnectionRegistry.markAuthFailure("invalid_token");
          app.log.warn({
            scope: "communications.live.auth",
            outcome: "failed",
            reason: "invalid_token",
            correlationId,
          });
          socket.close(1008, "Unauthorized");
          return;
        }

        const accountId = new Types.ObjectId(session.id);
        liveConnectionRegistry.registerSocket(accountId, socket);

        const metrics = liveConnectionRegistry.getLiveMetrics();
        app.log.info({
          scope: "communications.live.connection",
          outcome: "connected",
          accountId: accountId.toString(),
          sessionType: session.type,
          connectedUsers: metrics.connectedUsers,
          connectedSockets: metrics.connectedSockets,
          correlationId,
        });

        socket.send(
          JSON.stringify(toLiveConnectedMessage(accountId.toString())),
        );
      })();
    }
  );
};

