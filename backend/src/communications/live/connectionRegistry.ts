import type { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { Types } from "mongoose";
import type { LiveInAppNotificationEvent } from "../types.ts";
import { toNotificationCreatedMessage } from "./contracts.ts";
import {
  recordLiveAuthFailure,
  recordLivePushMetrics,
} from "../observability/metrics.ts";

type RegistryEntry = {
  socket: WebSocket;
  userId: string;
  isAlive: boolean;
};

const LOG_PREFIX = "[communications][liveRegistry]";
const HEARTBEAT_INTERVAL_MS = 30_000;

const entries = new Map<WebSocket, RegistryEntry>();
const socketsByUserId = new Map<string, Set<WebSocket>>();
let heartbeatTimer: NodeJS.Timeout | null = null;

const registerSocket = (userId: Types.ObjectId | string, socket: WebSocket): void => {
  const normalizedUserId = String(userId);

  const entry: RegistryEntry = { socket, userId: normalizedUserId, isAlive: true };
  entries.set(socket, entry);

  const existingSet = socketsByUserId.get(normalizedUserId) ?? new Set();
  existingSet.add(socket);
  socketsByUserId.set(normalizedUserId, existingSet);

  socket.on("pong", () => {
    const found = entries.get(socket);
    if (found) found.isAlive = true;
  });

  socket.on("close", () => {
    unregisterSocket(socket);
  });

  socket.on("error", () => {
    unregisterSocket(socket);
  });
};

const unregisterSocket = (socket: WebSocket): void => {
  const entry = entries.get(socket);
  if (!entry) return;

  entries.delete(socket);
  const set = socketsByUserId.get(entry.userId);
  if (!set) return;

  set.delete(socket);
  if (set.size === 0) {
    socketsByUserId.delete(entry.userId);
  }
};

const pushToUserIds = (
  event: LiveInAppNotificationEvent,
  logger?: FastifyBaseLogger
): { deliveredSockets: number; targetUsers: number; droppedPushes: number } => {
  const targetUserIds = Array.from(
    new Set(event.recipientUserIds.map((id) => id.toString()))
  );
  const payload = JSON.stringify(toNotificationCreatedMessage(event));

  let deliveredSockets = 0;
  let droppedPushes = 0;
  let offlineRecipientDrops = 0;
  let socketSendFailureDrops = 0;

  targetUserIds.forEach((userId) => {
    const sockets = socketsByUserId.get(userId);
    if (!sockets?.size) {
      droppedPushes += 1;
      offlineRecipientDrops += 1;
      return;
    }

    sockets.forEach((socket) => {
      if (socket.readyState !== socket.OPEN) return;
      try {
        socket.send(payload);
        deliveredSockets += 1;
      } catch {
        droppedPushes += 1;
        socketSendFailureDrops += 1;
        unregisterSocket(socket);
      }
    });
  });

  recordLivePushMetrics({
    deliveredSockets,
    droppedPushes,
    droppedByReason: {
      offlineRecipient: offlineRecipientDrops,
      socketSendFailure: socketSendFailureDrops,
    },
  });

  logger?.info(
    `${LOG_PREFIX} push targetUsers=${targetUserIds.length} deliveredSockets=${deliveredSockets} droppedPushes=${droppedPushes}`
  );

  return { deliveredSockets, targetUsers: targetUserIds.length, droppedPushes };
};

const startHeartbeat = (logger?: FastifyBaseLogger): void => {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    entries.forEach((entry, socket) => {
      if (!entry.isAlive) {
        try {
          socket.terminate();
        } finally {
          unregisterSocket(socket);
        }
        return;
      }

      entry.isAlive = false;
      try {
        socket.ping();
      } catch {
        unregisterSocket(socket);
      }
    });

    logger?.debug(
      `${LOG_PREFIX} heartbeat activeUsers=${socketsByUserId.size} activeSockets=${entries.size}`
    );
  }, HEARTBEAT_INTERVAL_MS);
};

const stopHeartbeat = (): void => {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
};

const clearAllConnections = (): void => {
  entries.forEach((entry, socket) => {
    try {
      socket.close();
    } catch {
      // ignore close errors during shutdown
    }
    unregisterSocket(socket);
  });
};

const getLiveMetrics = () => ({
  connectedUsers: socketsByUserId.size,
  connectedSockets: entries.size,
});

const markAuthFailure = (
  reason: "missing_bearer_token" | "invalid_token" | "non_user_session"
): void => {
  recordLiveAuthFailure(reason);
};

const liveConnectionRegistry = {
  registerSocket,
  unregisterSocket,
  pushToUserIds,
  startHeartbeat,
  stopHeartbeat,
  clearAllConnections,
  getLiveMetrics,
  markAuthFailure,
};

export default liveConnectionRegistry;

