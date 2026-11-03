/**
 * Cross-tab signalling transport.
 *
 * BroadcastChannel is preferred, with a `storage` event as the fallback for
 * browsers that lack it. A transport is transport only: it never reads or
 * writes application state. The signal type is supplied by the caller, so each
 * path keeps its own content-free shape and validates incoming messages.
 */
export type CrossTabSignal = {
  readonly type: string;
};

export type CrossTabMessage<TSignal extends CrossTabSignal> = TSignal & {
  readonly nonce: string;
};

export interface CrossTabTransport<TSignal extends CrossTabSignal> {
  /** Publish a content-free signal to other same-origin tabs. */
  publish(signal: TSignal): void;
  /** Subscribe to signals from other tabs. Returns an unsubscribe. */
  subscribe(onMessage: (message: CrossTabMessage<TSignal>) => void): () => void;
}

export interface CrossTabTransportConfig {
  /** BroadcastChannel name. */
  channelName: string;
  /** localStorage key used when BroadcastChannel is unavailable. */
  storageKey: string;
}

export function createCrossTabTransport<TSignal extends CrossTabSignal>(
  config: CrossTabTransportConfig,
): CrossTabTransport<TSignal> {
  const { channelName, storageKey } = config;

  function openChannel(): BroadcastChannel | null {
    const Constructor = globalThis.BroadcastChannel;
    if (typeof Constructor !== "function") return null;
    try {
      return new Constructor(channelName);
    } catch {
      return null;
    }
  }

  function createMessage(signal: TSignal): CrossTabMessage<TSignal> {
    return {
      ...signal,
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }

  function isEnvelope(value: unknown): value is { type: string; nonce: string } {
    if (!value || typeof value !== "object") return false;
    const candidate = value as { type?: unknown; nonce?: unknown };
    return (
      typeof candidate.type === "string" &&
      candidate.type.length > 0 &&
      typeof candidate.nonce === "string" &&
      candidate.nonce.length > 0
    );
  }

  function publish(signal: TSignal): void {
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
      window.localStorage.setItem(storageKey, JSON.stringify(message));
    } catch {
      // Storage can be blocked; the authoritative state stays server-side.
    }
  }

  function subscribe(
    onMessage: (message: CrossTabMessage<TSignal>) => void,
  ): () => void {
    const channel = openChannel();
    if (channel) {
      const listener = (event: MessageEvent) => {
        if (isEnvelope(event.data)) {
          onMessage(event.data as CrossTabMessage<TSignal>);
        }
      };
      channel.addEventListener("message", listener);
      return () => {
        channel.removeEventListener("message", listener);
        channel.close();
      };
    }

    if (typeof window === "undefined") return () => {};

    const listener = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const message: unknown = JSON.parse(event.newValue);
        if (isEnvelope(message)) {
          onMessage(message as CrossTabMessage<TSignal>);
        }
      } catch {
        // A malformed value from another version is ignored.
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }

  return { publish, subscribe };
}
