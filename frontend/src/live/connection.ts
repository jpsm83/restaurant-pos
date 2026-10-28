/**
 * One live WebSocket per signed-in browser tab.
 *
 * Guest browsers do not connect. Sign-in starts a ticket exchange: the access
 * JWT stays in the Authorization header of an authenticated HTTP request, and
 * the socket URL carries only a one-minute, single-use ticket. Sign-out closes
 * so the next person on this tab does not inherit it. A refreshed access session
 * does not replace an already-open socket; the next connect uses the new token.
 *
 * A signed-in tab is live only after the server acknowledges the socket and,
 * on reconnect, after query resync finishes. Writes stay blocked until then.
 */
import { resolveApiBaseUrl } from "@/services/apiBaseUrl";

const LIVE_PATH = "/api/v1/notifications/live";
const LIVE_TICKET_PATH = "/api/v1/auth/live-ticket";
const DEFAULT_RECONNECT_DELAY_MS = 250;

export type LiveConnectionStatus =
  | "idle"
  | "connecting"
  | "disconnected"
  | "reconnecting"
  | "live";

type LiveSocket = {
  close: () => void;
  readyState: number;
};

type SocketEventMap = {
  close: unknown;
  message: { data?: unknown };
};

type EventAwareSocket = LiveSocket & {
  addEventListener?: (
    type: keyof SocketEventMap,
    listener: (event?: SocketEventMap[keyof SocketEventMap]) => void,
  ) => void;
  onclose?: (() => void) | null;
  onmessage?: ((event: { data?: unknown }) => void) | null;
};

type LiveSocketCtor = new (url: string) => LiveSocket;

export type LiveTicketRequest = (
  accessToken: string,
) => string | null | Promise<string | null>;

export interface LiveConnection {
  sync: (accessToken: string | null) => void;
  close: () => void;
  canCommitWrite: () => boolean;
  getStatus: () => LiveConnectionStatus;
  subscribe: (listener: (status: LiveConnectionStatus) => void) => () => void;
}

export interface LiveConnectionOptions {
  WebSocket?: LiveSocketCtor;
  resync?: () => void | Promise<void>;
  scheduleReconnect?: (attempt: () => void) => void;
  /** Injection point for tests; defaults to the authenticated ticket endpoint. */
  requestTicket?: LiveTicketRequest;
}

const CONNECTING = 0;
const OPEN = 1;

function isHeld(socket: LiveSocket | null): socket is LiveSocket {
  return (
    socket !== null &&
    (socket.readyState === CONNECTING || socket.readyState === OPEN)
  );
}

function resolveLiveSocketUrl(ticket: string): string {
  const path = `${LIVE_PATH}?ticket=${encodeURIComponent(ticket)}`;
  const configured =
    typeof import.meta.env.VITE_API_BASE_URL === "string"
      ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, "")
      : "";

  if (typeof window === "undefined") {
    return `ws://localhost${path}`;
  }

  const pageProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const pageUrl = `${pageProtocol}//${window.location.host}${path}`;

  if (!configured) {
    return pageUrl;
  }

  let api: URL;
  try {
    api = new URL(configured);
  } catch {
    return pageUrl;
  }

  if (window.location.origin === api.origin || import.meta.env.DEV) {
    return pageUrl;
  }

  const wsProtocol = api.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${api.host}${path}`;
}

function resolveSocketCtor(
  override?: LiveSocketCtor,
): LiveSocketCtor | null {
  if (override) return override;
  if (typeof WebSocket === "undefined") return null;
  return WebSocket;
}

function isLiveConnectedAck(data: unknown): boolean {
  if (typeof data !== "string") return false;
  try {
    const parsed = JSON.parse(data) as { type?: unknown };
    return parsed.type === "live.connected";
  } catch {
    return false;
  }
}

async function defaultRequestTicket(
  accessToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `${resolveApiBaseUrl()}${LIVE_TICKET_PATH}`,
      {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!response.ok) return null;

    const body = (await response.json()) as { ticket?: unknown };
    return typeof body.ticket === "string" && body.ticket.length > 0
      ? body.ticket
      : null;
  } catch {
    return null;
  }
}

async function defaultResync(): Promise<void> {
  const { queryClient } = await import("@/services/queryClient");
  await queryClient.refetchQueries({ type: "active" });
}

export function createLiveConnection(
  options: LiveConnectionOptions = {},
): LiveConnection {
  let socket: LiveSocket | null = null;
  let lastAccessToken: string | null = null;
  let openGeneration = 0;
  let resyncGeneration = 0;
  let everLive = false;
  let opening = false;
  let resyncing = false;
  let live = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(status: LiveConnectionStatus) => void>();
  const socketCtor = resolveSocketCtor(options.WebSocket);
  const resync = options.resync ?? defaultResync;
  const requestTicket = options.requestTicket ?? defaultRequestTicket;

  const notify = () => {
    const status = readStatus();
    listeners.forEach((listener) => listener(status));
  };

  const isConnecting = () => opening || isHeld(socket);

  const readStatus = (): LiveConnectionStatus => {
    if (!lastAccessToken) return "idle";
    if (live) return "live";
    if (resyncing || isConnecting()) {
      return everLive ? "reconnecting" : "connecting";
    }
    return "disconnected";
  };

  const attachEvent = (
    held: LiveSocket,
    type: keyof SocketEventMap,
    handler: (event?: SocketEventMap[typeof type]) => void,
  ) => {
    const eventAware = held as EventAwareSocket;
    if (typeof eventAware.addEventListener === "function") {
      eventAware.addEventListener(type, handler);
      return;
    }
    if (type === "close") eventAware.onclose = () => handler();
    if (type === "message") {
      eventAware.onmessage = (event) => handler(event);
    }
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer === null) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const closeHeldSocket = () => {
    openGeneration += 1;
    resyncGeneration += 1;
    opening = false;
    resyncing = false;
    live = false;
    if (!socket) return;
    socket.close();
    socket = null;
  };

  const becomeLive = () => {
    everLive = true;
    resyncing = false;
    live = true;
    notify();
  };

  const startResync = () => {
    const generation = (resyncGeneration += 1);
    resyncing = true;
    live = false;
    notify();
    void Promise.resolve(resync()).then(
      () => {
        if (generation !== resyncGeneration) return;
        if (!lastAccessToken || !isHeld(socket)) return;
        becomeLive();
      },
      () => {
        if (generation !== resyncGeneration) return;
        resyncing = true;
        live = false;
        notify();
      },
    );
  };

  const onAcknowledged = () => {
    if (everLive) {
      startResync();
      return;
    }
    becomeLive();
  };

  const onSocketClosed = (generation: number) => {
    if (generation !== openGeneration) return;
    socket = null;
    live = false;
    resyncing = false;
    if (!lastAccessToken) {
      notify();
      return;
    }
    notify();
    scheduleReconnectAttempt();
  };

  const scheduleReconnectAttempt = () => {
    if (!lastAccessToken) return;
    clearReconnectTimer();
    const tokenAtSchedule = lastAccessToken;
    const run = () => {
      reconnectTimer = null;
      if (lastAccessToken !== tokenAtSchedule) return;
      if (isConnecting()) return;
      open();
    };
    if (options.scheduleReconnect) {
      options.scheduleReconnect(run);
      return;
    }
    reconnectTimer = setTimeout(run, DEFAULT_RECONNECT_DELAY_MS);
  };

  const handleTicket = (
    generation: number,
    ticket: string | null,
  ) => {
    if (generation !== openGeneration) return;
    if (!lastAccessToken) return;

    opening = false;

    if (!ticket) {
      notify();
      scheduleReconnectAttempt();
      return;
    }

    socket = new socketCtor!(resolveLiveSocketUrl(ticket));
    attachEvent(socket, "close", () => onSocketClosed(generation));
    attachEvent(socket, "message", (event) => {
      if (generation !== openGeneration) return;
      const data =
        event && typeof event === "object" && "data" in event
          ? (event as { data?: unknown }).data
          : undefined;
      if (isLiveConnectedAck(data)) onAcknowledged();
    });
    notify();
  };

  const open = () => {
    if (!socketCtor || !lastAccessToken) return;
    const generation = (openGeneration += 1);
    const token = lastAccessToken;
    live = false;
    opening = true;
    notify();

    let requested: string | null | Promise<string | null>;
    try {
      requested = requestTicket(token);
    } catch {
      requested = null;
    }

    if (requested instanceof Promise) {
      void requested.then(
        (ticket) => handleTicket(generation, ticket),
        () => handleTicket(generation, null),
      );
      return;
    }

    handleTicket(generation, requested);
  };

  return {
    sync(accessToken: string | null) {
      lastAccessToken = accessToken;
      if (!accessToken) {
        clearReconnectTimer();
        everLive = false;
        closeHeldSocket();
        notify();
        return;
      }
      if (isConnecting()) {
        notify();
        return;
      }
      open();
    },
    close() {
      lastAccessToken = null;
      clearReconnectTimer();
      everLive = false;
      closeHeldSocket();
      notify();
    },
    canCommitWrite() {
      if (!lastAccessToken) return true;
      return live && !resyncing;
    },
    getStatus: readStatus,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

let shared: LiveConnection = createLiveConnection();

export function syncLiveConnection(accessToken: string | null): void {
  shared.sync(accessToken);
}

export function canCommitWrite(): boolean {
  return shared.canCommitWrite();
}

export function getLiveStatus(): LiveConnectionStatus {
  return shared.getStatus();
}

export function subscribeLiveStatus(
  listener: (status: LiveConnectionStatus) => void,
): () => void {
  const unsubscribe = shared.subscribe(listener);
  return unsubscribe;
}

export function resetLiveConnectionForTests(
  options: LiveConnectionOptions = {},
): void {
  shared.close();
  shared = createLiveConnection(options);
}
