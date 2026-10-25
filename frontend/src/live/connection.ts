/**
 * One live WebSocket per signed-in browser tab.
 *
 * Guest browsers do not connect. Sign-in opens immediately with the access
 * session just received. Sign-out closes so the next person on this tab does
 * not inherit it. A refreshed access session does not replace an already-open
 * socket; the next connect uses the token passed to sync.
 */

const LIVE_PATH = "/api/v1/notifications/live";

type LiveSocket = {
  close: () => void;
  readyState: number;
};

type CloseAwareSocket = LiveSocket & {
  addEventListener?: (type: "close", listener: () => void) => void;
  onclose?: (() => void) | null;
};

type LiveSocketCtor = new (url: string) => LiveSocket;

export interface LiveConnection {
  sync: (accessToken: string | null) => void;
  close: () => void;
}

export interface LiveConnectionOptions {
  WebSocket?: LiveSocketCtor;
}

const CONNECTING = 0;
const OPEN = 1;

function isHeld(socket: LiveSocket | null): socket is LiveSocket {
  return (
    socket !== null &&
    (socket.readyState === CONNECTING || socket.readyState === OPEN)
  );
}

function resolveLiveSocketUrl(accessToken: string): string {
  const path = `${LIVE_PATH}?access_token=${encodeURIComponent(accessToken)}`;
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

export function createLiveConnection(
  options: LiveConnectionOptions = {},
): LiveConnection {
  let socket: LiveSocket | null = null;
  let lastAccessToken: string | null = null;
  let openGeneration = 0;
  const socketCtor = resolveSocketCtor(options.WebSocket);

  const attachClose = (held: LiveSocket, onClose: () => void) => {
    const closeAware = held as CloseAwareSocket;
    if (typeof closeAware.addEventListener === "function") {
      closeAware.addEventListener("close", onClose);
      return;
    }
    closeAware.onclose = onClose;
  };

  const closeHeldSocket = () => {
    if (!socket) return;
    openGeneration += 1;
    socket.close();
    socket = null;
  };

  const open = () => {
    if (!socketCtor || !lastAccessToken) return;
    const generation = (openGeneration += 1);
    socket = new socketCtor(resolveLiveSocketUrl(lastAccessToken));
    attachClose(socket, () => {
      if (generation !== openGeneration) return;
      socket = null;
    });
  };

  return {
    sync(accessToken: string | null) {
      lastAccessToken = accessToken;
      if (!accessToken) {
        closeHeldSocket();
        return;
      }
      if (isHeld(socket)) return;
      open();
    },
    close() {
      lastAccessToken = null;
      closeHeldSocket();
    },
  };
}

let shared: LiveConnection = createLiveConnection();

export function syncLiveConnection(accessToken: string | null): void {
  shared.sync(accessToken);
}

export function resetLiveConnectionForTests(
  options: LiveConnectionOptions = {},
): void {
  shared.close();
  shared = createLiveConnection(options);
}
