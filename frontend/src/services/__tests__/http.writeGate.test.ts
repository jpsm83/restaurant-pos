import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resetLiveConnectionForTests,
  syncLiveConnection,
} from "@/live/connection";
import { liveAckAndBecomeLive, HarnessSocket } from "@/live/__tests__/socketHarness";
import { WriteBlockedError } from "@/live/writeGate";
import { http } from "../http";

const requests: Array<{ method?: string; url?: string }> = [];
const originalAdapter = http.defaults.adapter;

function okResponse(config: InternalAxiosRequestConfig) {
  return {
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

describe("http write gate", () => {
  beforeEach(() => {
    requests.length = 0;
    HarnessSocket.reset();
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      scheduleReconnect: () => undefined,
    });
    http.defaults.adapter = async (config) => {
      requests.push({ method: config.method, url: config.url });
      return okResponse(config);
    };
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    resetLiveConnectionForTests();
    HarnessSocket.reset();
  });

  async function signInDisconnected() {
    syncLiveConnection("session-token");
  }

  async function signInLive() {
    syncLiveConnection("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());
  }

  it("does not send set-mode, profile save, or table-layout save while disconnected", async () => {
    await signInDisconnected();

    await expect(http.post("/api/v1/auth/set-mode", { mode: "customer" })).rejects.toBeInstanceOf(
      WriteBlockedError,
    );
    await expect(http.patch("/api/v1/business/b-1", {})).rejects.toBeInstanceOf(
      WriteBlockedError,
    );
    await expect(http.post("/api/v1/tables/layout", { columns: [] })).rejects.toBeInstanceOf(
      WriteBlockedError,
    );

    expect(requests).toEqual([]);
  });

  it("still loads a table POST that is a read", async () => {
    await signInDisconnected();

    await http.post(
      "/api/v1/tables/rows",
      { page: 1 },
      { skipWriteGate: true } as AxiosRequestConfig,
    );

    expect(requests).toEqual([{ method: "post", url: "/api/v1/tables/rows" }]);
  });

  it("still sends GET reads while disconnected", async () => {
    await signInDisconnected();

    await http.get("/api/v1/business/b-1");

    expect(requests).toEqual([{ method: "get", url: "/api/v1/business/b-1" }]);
  });

  it("lets session auth POSTs through without the write gate", async () => {
    await signInDisconnected();

    await http.post("/api/v1/auth/login", { email: "a@b.co", password: "x" });
    await http.post("/api/v1/auth/refresh");
    await http.post("/api/v1/auth/logout");
    await http.post("/api/v1/auth/reset-password", { token: "t", newPassword: "n" });

    expect(requests).toEqual([
      { method: "post", url: "/api/v1/auth/login" },
      { method: "post", url: "/api/v1/auth/refresh" },
      { method: "post", url: "/api/v1/auth/logout" },
      { method: "post", url: "/api/v1/auth/reset-password" },
    ]);
  });

  it("sends domain writes again after the tab is live", async () => {
    await signInLive();

    await http.post("/api/v1/auth/set-mode", { mode: "customer" });
    await http.patch("/api/v1/business/b-1", {});

    expect(requests).toEqual([
      { method: "post", url: "/api/v1/auth/set-mode" },
      { method: "patch", url: "/api/v1/business/b-1" },
    ]);
  });
});
