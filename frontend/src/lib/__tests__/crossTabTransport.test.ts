import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCrossTabTransport } from "../crossTabTransport";

type MessageListener = (event: MessageEvent) => void;

class FakeBroadcastChannel {
  static instances = new Set<FakeBroadcastChannel>();
  static sent: unknown[] = [];

  readonly name: string;

  private listeners = new Set<MessageListener>();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.add(this);
  }

  addEventListener(type: string, listener: MessageListener) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: MessageListener) {
    if (type === "message") this.listeners.delete(listener);
  }

  postMessage(data: unknown) {
    FakeBroadcastChannel.sent.push(data);
    for (const channel of FakeBroadcastChannel.instances) {
      if (channel === this) continue;
      for (const listener of channel.listeners) {
        listener({ data } as MessageEvent);
      }
    }
  }

  close() {
    FakeBroadcastChannel.instances.delete(this);
  }
}

const config = {
  channelName: "restaurant-pos:test",
  storageKey: "restaurant-pos:test-change",
};

describe("crossTabTransport", () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances.clear();
    FakeBroadcastChannel.sent = [];
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("publishes a nonce-tagged signal through BroadcastChannel", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const transport = createCrossTabTransport<{ type: "test-signal" }>(config);
    const onMessage = vi.fn();
    const unsubscribe = transport.subscribe(onMessage);

    transport.publish({ type: "test-signal" });

    expect(onMessage).toHaveBeenCalledWith({
      type: "test-signal",
      nonce: expect.any(String),
    });
    unsubscribe();
  });

  it("falls back to a storage event when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const transport = createCrossTabTransport<{ type: "test-signal" }>(config);
    const onMessage = vi.fn();
    const unsubscribe = transport.subscribe(onMessage);

    transport.publish({ type: "test-signal" });
    const newValue = localStorage.getItem(config.storageKey);
    window.dispatchEvent(
      new StorageEvent("storage", { key: config.storageKey, newValue }),
    );

    expect(onMessage).toHaveBeenCalledWith({
      type: "test-signal",
      nonce: expect.any(String),
    });
    unsubscribe();
  });

  it("ignores malformed, foreign, and missing-nonce messages", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const transport = createCrossTabTransport<{ type: "test-signal" }>(config);
    const onMessage = vi.fn();
    const unsubscribe = transport.subscribe(onMessage);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "unrelated",
        newValue: JSON.stringify({ type: "test-signal", nonce: "n" }),
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: config.storageKey, newValue: "{x" }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.storageKey,
        newValue: JSON.stringify({ type: "test-signal" }),
      }),
    );

    expect(onMessage).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const transport = createCrossTabTransport<{ type: "test-signal" }>(config);
    const onMessage = vi.fn();
    const unsubscribe = transport.subscribe(onMessage);

    unsubscribe();
    transport.publish({ type: "test-signal" });

    expect(onMessage).not.toHaveBeenCalled();
  });
});
