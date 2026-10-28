/**
 * Cross-tab notification for Customer | Business mode changes.
 *
 * The refresh session on the server stays authoritative; tabs exchange only a
 * content-free invalidation signal, then refetch `GET /auth/mode`. BroadcastChannel
 * is preferred, with a `storage` event as the fallback for older browsers.
 */
const CHANNEL_NAME = "restaurant-pos:auth-mode";
const STORAGE_KEY = "restaurant-pos:auth-mode-change";

type AuthModeChangeMessage = {
  type: "auth-mode-changed";
  id: string;
};

function createMessage(): AuthModeChangeMessage {
  return {
    type: "auth-mode-changed",
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}

function isAuthModeChangeMessage(
  value: unknown,
): value is AuthModeChangeMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown };
  return candidate.type === "auth-mode-changed";
}

function openChannel(): BroadcastChannel | null {
  const Constructor = globalThis.BroadcastChannel;
  if (typeof Constructor !== "function") return null;
  try {
    return new Constructor(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/** Tell other same-origin tabs that the stored mode changed. */
export function publishAuthModeChange(): void {
  const message = createMessage();
  const channel = openChannel();
  if (channel) {
    let sent = false;
    try {
      channel.postMessage(message);
      sent = true;
    } catch {
      // Fall through to the storage fallback.
    } finally {
      channel.close();
    }
    if (sent) return;
  }

  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    // Storage can be blocked; the server session remains authoritative.
  }
}

/** Subscribe to mode changes published by another tab. Returns an unsubscribe function. */
export function subscribeToAuthModeChanges(
  onChange: () => void,
): () => void {
  const channel = openChannel();
  if (channel) {
    const listener = (event: MessageEvent) => {
      if (isAuthModeChangeMessage(event.data)) onChange();
    };
    channel.addEventListener("message", listener);
    return () => {
      channel.removeEventListener("message", listener);
      channel.close();
    };
  }

  if (typeof window === "undefined") return () => {};

  const listener = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      if (isAuthModeChangeMessage(JSON.parse(event.newValue))) onChange();
    } catch {
      // A malformed value from another origin/version is ignored.
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
