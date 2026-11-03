/**
 * Cross-tab notification for Customer | Business mode changes.
 *
 * The refresh session on the server stays authoritative; tabs exchange only a
 * content-free invalidation signal, then refetch `GET /auth/mode`.
 */
import {
  createCrossTabTransport,
  type CrossTabMessage,
} from "@/lib/crossTabTransport";

type AuthModeChangeSignal = {
  readonly type: "auth-mode-changed";
};

const transport = createCrossTabTransport<AuthModeChangeSignal>({
  channelName: "restaurant-pos:auth-mode",
  storageKey: "restaurant-pos:auth-mode-change",
});

function isAuthModeChangeMessage(
  message: CrossTabMessage<AuthModeChangeSignal>,
): boolean {
  return message.type === "auth-mode-changed";
}

/** Tell other same-origin tabs that the stored mode changed. */
export function publishAuthModeChange(): void {
  transport.publish({ type: "auth-mode-changed" });
}

/** Subscribe to mode changes published by another tab. Returns an unsubscribe function. */
export function subscribeToAuthModeChanges(
  onChange: () => void,
): () => void {
  return transport.subscribe((message) => {
    if (isAuthModeChangeMessage(message)) onChange();
  });
}
