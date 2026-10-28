import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishAuthModeChange,
  subscribeToAuthModeChanges,
} from "../authModeSync";

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

describe("authModeSync", () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances.clear();
    FakeBroadcastChannel.sent = [];
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("notifies subscribers through BroadcastChannel without carrying the mode", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const onChange = vi.fn();
    const unsubscribe = subscribeToAuthModeChanges(onChange);

    publishAuthModeChange();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(FakeBroadcastChannel.sent).toHaveLength(1);
    expect(FakeBroadcastChannel.sent[0]).toMatchObject({
      type: "auth-mode-changed",
    });
    expect(FakeBroadcastChannel.sent[0]).not.toHaveProperty("mode");

    unsubscribe();
    publishAuthModeChange();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("falls back to a storage event when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const onChange = vi.fn();
    const unsubscribe = subscribeToAuthModeChanges(onChange);

    publishAuthModeChange();

    const key = Object.keys(localStorage).find((candidate) =>
      candidate.includes("auth-mode"),
    );
    expect(key).toBeTruthy();
    const newValue = key ? localStorage.getItem(key) : null;

    window.dispatchEvent(
      new StorageEvent("storage", { key: key ?? null, newValue }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "unrelated", newValue }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(
      new StorageEvent("storage", { key: key ?? null, newValue }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
