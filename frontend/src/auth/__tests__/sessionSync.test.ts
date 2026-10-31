import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishAuthSignIn,
  publishAuthSignOut,
  subscribeToAuthSessionChanges,
} from "../sessionSync";

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

const FORBIDDEN_FIELDS = [
  "accessToken",
  "refreshToken",
  "token",
  "email",
  "userId",
  "user",
  "mode",
  "credential",
  "password",
];

describe("sessionSync", () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances.clear();
    FakeBroadcastChannel.sent = [];
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("distinguishes sign-in from sign-out and from the mode-change signal", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const onSignal = vi.fn();
    const unsubscribe = subscribeToAuthSessionChanges(onSignal);

    publishAuthSignIn();
    publishAuthSignOut();

    expect(onSignal).toHaveBeenNthCalledWith(1, "sign-in");
    expect(onSignal).toHaveBeenNthCalledWith(2, "sign-out");
    expect(FakeBroadcastChannel.sent).toHaveLength(2);
    expect(FakeBroadcastChannel.sent[0]).toMatchObject({
      type: "auth-session-changed",
      signal: "sign-in",
    });
    expect(FakeBroadcastChannel.sent[1]).toMatchObject({
      type: "auth-session-changed",
      signal: "sign-out",
    });
    expect(FakeBroadcastChannel.sent[0]).not.toMatchObject({
      type: "auth-mode-changed",
    });

    unsubscribe();
  });

  it("carries no credential, identity, or mode in the payload", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const unsubscribe = subscribeToAuthSessionChanges(vi.fn());

    publishAuthSignIn();
    publishAuthSignOut();

    for (const message of FakeBroadcastChannel.sent) {
      expect(message).toBeTypeOf("object");
      for (const field of FORBIDDEN_FIELDS) {
        expect(message).not.toHaveProperty(field);
      }
    }

    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const onSignal = vi.fn();
    const unsubscribe = subscribeToAuthSessionChanges(onSignal);

    unsubscribe();
    publishAuthSignIn();

    expect(onSignal).not.toHaveBeenCalled();
  });

  it("falls back to a storage event when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const onSignal = vi.fn();
    const unsubscribe = subscribeToAuthSessionChanges(onSignal);

    publishAuthSignIn();
    const signInValue = readSessionStorageValue();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: findSessionStorageKey(),
        newValue: signInValue,
      }),
    );

    publishAuthSignOut();
    const signOutValue = readSessionStorageValue();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: findSessionStorageKey(),
        newValue: signOutValue,
      }),
    );

    expect(onSignal).toHaveBeenNthCalledWith(1, "sign-in");
    expect(onSignal).toHaveBeenNthCalledWith(2, "sign-out");

    unsubscribe();
  });

  it("ignores malformed, foreign, and unrelated storage events", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const onSignal = vi.fn();
    const unsubscribe = subscribeToAuthSessionChanges(onSignal);

    publishAuthSignIn();
    const key = findSessionStorageKey();
    const validValue = readSessionStorageValue();

    window.dispatchEvent(
      new StorageEvent("storage", { key: "unrelated", newValue: validValue }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: "{not json" }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: JSON.stringify({ type: "auth-mode-changed", id: "x" }),
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: JSON.stringify({
          type: "auth-session-changed",
          signal: "unknown",
          nonce: "x",
        }),
      }),
    );

    expect(onSignal).not.toHaveBeenCalled();

    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: validValue }),
    );
    expect(onSignal).toHaveBeenCalledWith("sign-in");

    unsubscribe();
  });

  it("stops listening to storage events after unsubscribe", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const onSignal = vi.fn();
    const unsubscribe = subscribeToAuthSessionChanges(onSignal);

    publishAuthSignIn();
    const key = findSessionStorageKey();
    const value = readSessionStorageValue();

    unsubscribe();
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: value }),
    );

    expect(onSignal).not.toHaveBeenCalled();
  });
});

function findSessionStorageKey(): string | null {
  return (
    Object.keys(localStorage).find((candidate) =>
      candidate.includes("auth-session"),
    ) ?? null
  );
}

function readSessionStorageValue(): string | null {
  const key = findSessionStorageKey();
  return key ? localStorage.getItem(key) : null;
}
