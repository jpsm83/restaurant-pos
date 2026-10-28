import type { ReactNode } from "react";
import type { InternalAxiosRequestConfig } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthMode } from "@/services/authMode";
import { updateBusinessProfile } from "@/services/business/businessProfileApi";
import { http } from "@/services/http";
import { useTableConfigData } from "@/features/advancedTable/hooks/useTableConfigData";
import {
  resetLiveConnectionForTests,
  syncLiveConnection,
} from "../connection";
import { HarnessSocket } from "./socketHarness";

const requests: Array<{ method?: string; url?: string }> = [];
const originalAdapter = http.defaults.adapter;

function okResponse(config: InternalAxiosRequestConfig, data: unknown = {}) {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

describe("signed-in mutations obey the write gate", () => {
  beforeEach(() => {
    requests.length = 0;
    HarnessSocket.reset();
    resetLiveConnectionForTests({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
      scheduleReconnect: () => undefined,
    });
    syncLiveConnection("session-token");
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

  it("does not send set-mode while disconnected and tells the person it is blocked", async () => {
    await expect(setAuthMode("customer")).rejects.toThrow(
      "This action is blocked until the connection is live again.",
    );
    expect(requests).toEqual([]);
  });

  it("does not send a venue-profile save while disconnected", async () => {
    await expect(
      updateBusinessProfile("b-1", new FormData()),
    ).rejects.toMatchObject({
      message: "This action is blocked until the connection is live again.",
    });
    expect(requests).toEqual([]);
  });

  it("does not send a table-layout save while disconnected", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    }
    const { result } = renderHook(
      () =>
        useTableConfigData({
          loadUrl: "/api/v1/tables/config",
          saveUrl: "/api/v1/tables/config",
        }),
      { wrapper: Wrapper },
    );

    await expect(
      result.current.save([
        {
          columnKey: "id",
          columnName: "ID",
          order: 0,
          enable: true,
          visible: true,
        },
      ]),
    ).resolves.toBe(false);

    expect(requests.filter((request) => request.method === "post")).toEqual([]);
  });

  it("does not store a blocked write in a domain-write queue", async () => {
    await expect(setAuthMode("business")).rejects.toBeInstanceOf(Error);
    const storedKeys = [
      ...Object.keys(localStorage),
      ...Object.keys(sessionStorage),
    ];
    expect(
      storedKeys.filter(
        (key) => key.includes("write-queue") || key.includes("offline-write"),
      ),
    ).toEqual([]);
  });
});
