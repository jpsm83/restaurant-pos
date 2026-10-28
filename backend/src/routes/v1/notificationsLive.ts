import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";

import liveConnectionRegistry from "../../communications/live/connectionRegistry.ts";
import { toLiveConnectedMessage } from "../../communications/live/contracts.ts";
import { consumeLiveTicket } from "../../auth/liveTicketStore.ts";
import {
  assertAccessTokenRefreshSessionLive,
  assertAccountCanUseSession,
  isRejectedCredential,
} from "../../auth/middleware.ts";
import {
  buildAuthBusinessSessionFromId,
  buildAuthUserSessionFromUserId,
} from "../../auth/issueSession.ts";
import type { AuthSession } from "../../auth/types.ts";
import { unauthorized } from "../../errors/appError.ts";

const parseTicketFromQuery = (url?: string): string | null => {
  if (!url || !url.includes("?")) return null;
  const query = url.slice(url.indexOf("?") + 1);
  const params = new URLSearchParams(query);
  const ticket = params.get("ticket")?.trim();
  return ticket && ticket.length > 0 ? ticket : null;
};

async function sessionForTicket(ticket: string): Promise<AuthSession> {
  const record = consumeLiveTicket(ticket);
  if (!record) {
    throw unauthorized("Invalid or expired live ticket");
  }

  await assertAccessTokenRefreshSessionLive({
    id: record.accountId,
    type: record.accountType,
    sessionId: record.sessionId,
  } as AuthSession & { sessionId: string });

  const session =
    record.accountType === "user"
      ? await buildAuthUserSessionFromUserId(record.accountId)
      : await buildAuthBusinessSessionFromId(record.accountId);

  if (!session) {
    throw unauthorized("Invalid or expired live ticket");
  }

  await assertAccountCanUseSession(session);
  return session;
}

export const notificationsLiveRoutes: FastifyPluginAsync = async (app) => {
  // Route boundary:
  // - Connection/authentication/registry concerns only.
  // - The URL carries a one-minute, single-use ticket, never the access JWT.
  // - Live notification push is switched in the bridge, not here.
  // - No notification persistence or fanout writes occur here.
  liveConnectionRegistry.startHeartbeat(app.log);

  app.get(
    "/live",
    { websocket: true },
    (socket, req) => {
      const correlationId = req.id;
      const ticket = parseTicketFromQuery(req.url);
      if (!ticket) {
        liveConnectionRegistry.markAuthFailure("missing_ticket");
        app.log.warn({
          scope: "communications.live.auth",
          outcome: "failed",
          reason: "missing_ticket",
          correlationId,
        });
        socket.close(1008, "Unauthorized");
        return;
      }

      void (async () => {
        let session: AuthSession;
        try {
          session = await sessionForTicket(ticket);
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
          liveConnectionRegistry.markAuthFailure("invalid_ticket");
          app.log.warn({
            scope: "communications.live.auth",
            outcome: "failed",
            reason: "invalid_ticket",
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
    },
  );
};
