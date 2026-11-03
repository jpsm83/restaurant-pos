/**
 * Cross-tab notification for sign-in and sign-out.
 *
 * The browser's refresh cookie stays authoritative; tabs exchange only a
 * content-free signal, then rehydrate or clear their own auth state. The
 * message carries no access token, refresh token, email, User id, mode, or
 * credential. This module owns the signal shape and never reads or writes auth
 * state.
 */
import {
  createCrossTabTransport,
  type CrossTabMessage,
} from "@/lib/crossTabTransport";

export type AuthSessionSignal = "sign-in" | "sign-out";

type AuthSessionChangeSignal = {
  readonly type: "auth-session-changed";
  readonly signal: AuthSessionSignal;
};

const transport = createCrossTabTransport<AuthSessionChangeSignal>({
  channelName: "restaurant-pos:auth-session",
  storageKey: "restaurant-pos:auth-session-change",
});

function isAuthSessionSignal(value: unknown): value is AuthSessionSignal {
  return value === "sign-in" || value === "sign-out";
}

function isAuthSessionChangeMessage(
  message: CrossTabMessage<AuthSessionChangeSignal>,
): boolean {
  return (
    message.type === "auth-session-changed" &&
    isAuthSessionSignal(message.signal)
  );
}

function publish(signal: AuthSessionSignal): void {
  transport.publish({ type: "auth-session-changed", signal });
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
  return transport.subscribe((message) => {
    if (isAuthSessionChangeMessage(message)) onSignal(message.signal);
  });
}
