import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n/i18n";
import { queryClient } from "@/services/queryClient";
import {
  createLiveConnection,
  getLiveStatus,
  resetLiveConnectionForTests,
  syncLiveConnection,
} from "../connection";
import {
  assertWritesAllowed,
  canCommitWrite,
  WriteBlockedError,
} from "../writeGate";
import { HarnessSocket, liveAckAndBecomeLive } from "./socketHarness";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("live connection write gate", () => {
  beforeEach(() => {
    HarnessSocket.reset();
    localStorage.clear();
    sessionStorage.clear();
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: (attempt) => attempt(),
    });
  });

  afterEach(() => {
    resetLiveConnectionForTests();
    HarnessSocket.reset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("does not gate a guest tab (no access session)", () => {
    syncLiveConnection(null);

    expect(getLiveStatus()).toBe("idle");
    expect(canCommitWrite()).toBe(true);
    expect(() => assertWritesAllowed()).not.toThrow();
    expect(HarnessSocket.instances).toHaveLength(0);
  });

  it("blocks writes until the signed-in tab is acknowledged live", () => {
    syncLiveConnection("session-token");

    expect(getLiveStatus()).toBe("connecting");
    expect(canCommitWrite()).toBe(false);
    expect(() => assertWritesAllowed()).toThrow(WriteBlockedError);
    expect(() => assertWritesAllowed()).toThrow(i18n.t("live.writeBlocked"));

    liveAckAndBecomeLive(HarnessSocket.latest());

    expect(getLiveStatus()).toBe("live");
    expect(canCommitWrite()).toBe(true);
    expect(() => assertWritesAllowed()).not.toThrow();
  });

  it("localizes the blocked-write message at throw time", async () => {
    syncLiveConnection("session-token");

    await i18n.changeLanguage("es");
    try {
      expect(() => assertWritesAllowed()).toThrow(
        "Esta acción está bloqueada hasta que la conexión vuelva a estar en vivo.",
      );
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it("shows disconnected while the socket is down and not yet reconnecting", () => {
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: () => {
        /* stay down so chrome can show disconnected */
      },
    });

    syncLiveConnection("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());
    HarnessSocket.latest().heartbeatDie();

    expect(getLiveStatus()).toBe("disconnected");
    expect(canCommitWrite()).toBe(false);
  });

  it("treats a heartbeat-dead socket as disconnected and resyncs before writes", async () => {
    const resync = deferred();
    let resyncCalls = 0;
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: (attempt) => attempt(),
      resync: () => {
        resyncCalls += 1;
        return resync.promise;
      },
    });

    syncLiveConnection("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());
    expect(canCommitWrite()).toBe(true);

    HarnessSocket.latest().heartbeatDie();

    expect(getLiveStatus()).toBe("reconnecting");
    expect(canCommitWrite()).toBe(false);

    const recovered = HarnessSocket.latest();
    liveAckAndBecomeLive(recovered);

    expect(getLiveStatus()).toBe("reconnecting");
    expect(canCommitWrite()).toBe(false);
    expect(resyncCalls).toBe(1);

    resync.resolve();
    await vi.waitFor(() => {
      expect(getLiveStatus()).toBe("live");
    });
    expect(canCommitWrite()).toBe(true);
  });

  it("keeps writes blocked for the whole query resync after reconnect", async () => {
    const resync = deferred();
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: (attempt) => attempt(),
      resync: () => resync.promise,
    });

    syncLiveConnection("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());
    HarnessSocket.latest().close();

    liveAckAndBecomeLive(HarnessSocket.latest());
    expect(canCommitWrite()).toBe(false);
    expect(getLiveStatus()).toBe("reconnecting");

    resync.resolve();
    await vi.waitFor(() => {
      expect(canCommitWrite()).toBe(true);
    });
    expect(getLiveStatus()).toBe("live");
  });

  it("does not retry or queue a blocked write after the tab is live again", async () => {
    const resync = deferred();
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: (attempt) => attempt(),
      resync: () => resync.promise,
    });

    syncLiveConnection("session-token");
    expect(() => assertWritesAllowed()).toThrow(WriteBlockedError);

    liveAckAndBecomeLive(HarnessSocket.latest());
    HarnessSocket.latest().close();
    expect(() => assertWritesAllowed()).toThrow(WriteBlockedError);

    liveAckAndBecomeLive(HarnessSocket.latest());
    resync.resolve();
    await vi.waitFor(() => {
      expect(canCommitWrite()).toBe(true);
    });

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(() => assertWritesAllowed()).not.toThrow();
  });

  it("keeps writes blocked when query resync fails", async () => {
    const resync = deferred();
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: (attempt) => attempt(),
      resync: () => resync.promise,
    });

    syncLiveConnection("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());
    HarnessSocket.latest().close();
    liveAckAndBecomeLive(HarnessSocket.latest());

    resync.reject(new Error("refetch failed"));
    await vi.waitFor(() => {
      expect(getLiveStatus()).toBe("reconnecting");
    });
    expect(canCommitWrite()).toBe(false);
  });

  it("lets one live tab keep writing while another tab is disconnected", () => {
    const first = createLiveConnection({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: (attempt) => attempt(),
    });
    const second = createLiveConnection({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: (attempt) => attempt(),
    });

    first.sync("tab-one");
    liveAckAndBecomeLive(HarnessSocket.instances[0]!);
    second.sync("tab-two");
    liveAckAndBecomeLive(HarnessSocket.instances[1]!);

    expect(first.canCommitWrite()).toBe(true);
    expect(second.canCommitWrite()).toBe(true);

    HarnessSocket.instances[0]!.heartbeatDie();

    expect(first.canCommitWrite()).toBe(false);
    expect(second.canCommitWrite()).toBe(true);

    first.close();
    second.close();
  });

  it("refetches already-loaded queries after reconnect before writes go out", async () => {
    const refetch = vi
      .spyOn(queryClient, "refetchQueries")
      .mockResolvedValue([] as never);
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: (attempt) => attempt(),
    });

    syncLiveConnection("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());
    HarnessSocket.latest().close();
    liveAckAndBecomeLive(HarnessSocket.latest());

    await vi.waitFor(() => {
      expect(refetch).toHaveBeenCalledWith({ type: "active" });
    });
    await vi.waitFor(() => {
      expect(canCommitWrite()).toBe(true);
    });
    refetch.mockRestore();
  });
});
