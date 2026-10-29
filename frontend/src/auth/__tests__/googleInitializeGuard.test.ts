import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installGoogleInitializeGuard,
  resetGoogleInitializeGuardForTests,
} from "../google";

type Initialize = (config: {
  client_id?: string;
  callback?: (response: { credential?: string }) => void;
}) => void;

function buildFakeGoogle() {
  const initialize = vi.fn<Initialize>();
  const idApi = { initialize };
  window.google = { accounts: { id: idApi } };
  return { initialize, idApi };
}

describe("installGoogleInitializeGuard", () => {
  beforeEach(() => {
    resetGoogleInitializeGuardForTests();
  });

  afterEach(() => {
    delete window.google;
  });

  it("initializes once per client id and forwards the latest callback", () => {
    const { initialize } = buildFakeGoogle();
    const first = vi.fn();
    const latest = vi.fn();

    installGoogleInitializeGuard();

    window.google?.accounts?.id?.initialize({
      client_id: "client-a",
      callback: first,
    });
    window.google?.accounts?.id?.initialize({
      client_id: "client-a",
      callback: latest,
    });

    expect(initialize).toHaveBeenCalledTimes(1);

    const registered = initialize.mock.calls[0]?.[0].callback;
    registered?.({ credential: "token" });

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith({ credential: "token" });
  });

  it("initializes again when the client id changes", () => {
    const { initialize } = buildFakeGoogle();

    installGoogleInitializeGuard();

    window.google?.accounts?.id?.initialize({ client_id: "client-a" });
    window.google?.accounts?.id?.initialize({ client_id: "client-b" });

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(initialize.mock.calls[1]?.[0].client_id).toBe("client-b");
  });

  it("is a no-op when the Google script has not loaded", () => {
    expect(() => installGoogleInitializeGuard()).not.toThrow();
  });
});
