/**
 * Cross-tab notification for sign-in and sign-out.
 *
 * The browser's refresh cookie stays authoritative; tabs exchange only a
 * content-free signal, then rehydrate or clear their own auth state. The
 * message carries no access token, refresh token, email, User id, mode, or
 * credential. This module is transport only and never reads or writes auth state.
 *
 * BroadcastChannel is preferred, with a `storage` event as the fallback.
 */
const CHANNEL_NAME = "restaurant-pos:auth-session";
const STORAGE_KEY = "restaurant-pos:auth-session-change";

export type AuthSessionSignal = "sign-in" | "sign-out";

type AuthSessionChangeMessage = {
  type: "auth-session-changed";
  signal: AuthSessionSignal;
  nonce: string;
};

function createMessage(signal: AuthSessionSignal): AuthSessionChangeMessage {
  return {
    type: "auth-session-changed",
    signal,
    nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}

function isAuthSessionSignal(value: unknown): value is AuthSessionSignal {
  return value === "sign-in" || value === "sign-out";
}

function isAuthSessionChangeMessage(
  value: unknown,
): value is AuthSessionChangeMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    type?: unknown;
    signal?: unknown;
    nonce?: unknown;
  };
  return (
    candidate.type === "auth-session-changed" &&
    isAuthSessionSignal(candidate.signal) &&
    typeof candidate.nonce === "string" &&
    candidate.nonce.length > 0
  );
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

function publish(signal: AuthSessionSignal): void {
  const message = createMessage(signal);
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
    // Storage can be blocked; the browser cookie remains authoritative.
  }
}

/** Tell other same-origin tabs that a sign-in happened. */
export function publishAuthSignIn(): void {
  publish("sign-in");
}

/** Tell other same-origin tabs that a sign-out happened. */
export function publishAuthSignOut(): void {
  publish("sign-out");
}

/**
 * Subscribe to sign-in/sign-out signals published by another tab.
 * Returns an unsubscribe function.
 */
export function subscribeToAuthSessionChanges(
  onSignal: (signal: AuthSessionSignal) => void,
): () => void {
  const channel = openChannel();
  if (channel) {
    const listener = (event: MessageEvent) => {
      if (isAuthSessionChangeMessage(event.data)) onSignal(event.data.signal);
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
      const message: unknown = JSON.parse(event.newValue);
      if (isAuthSessionChangeMessage(message)) onSignal(message.signal);
    } catch {
      // A malformed value from another version is ignored.
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
