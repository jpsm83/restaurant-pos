import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAccessToken } from "../api";
import { resetLiveConnectionForTests } from "@/live/connection";

class RecordingSocket {
  static urls: string[] = [];
  static instances: RecordingSocket[] = [];

  readyState = 1;
  closed = false;
  url: string;
  onclose: ((event?: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    RecordingSocket.urls.push(url);
    RecordingSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }

  static reset() {
    RecordingSocket.urls = [];
    RecordingSocket.instances = [];
  }
}

describe("access session opens and closes the live connection", () => {
  beforeEach(() => {
    RecordingSocket.reset();
    resetLiveConnectionForTests({ WebSocket: RecordingSocket });
    setAccessToken(null);
    RecordingSocket.reset();
  });

  afterEach(() => {
    setAccessToken(null);
    resetLiveConnectionForTests();
  });

  it("setAccessToken opens the live connection with the access session just received", () => {
    setAccessToken("fresh-access");

    expect(RecordingSocket.instances).toHaveLength(1);
    expect(RecordingSocket.urls[0]).toContain("access_token=fresh-access");
  });

  it("clearing the access session closes the live connection", () => {
    setAccessToken("fresh-access");
    const socket = RecordingSocket.instances[0];

    setAccessToken(null);

    expect(socket?.closed).toBe(true);
  });

  it("uses a refreshed access session on the next connect", () => {
    setAccessToken("old-access");
    setAccessToken("refreshed-access");
    expect(RecordingSocket.instances).toHaveLength(1);

    RecordingSocket.instances[0]?.close();
    setAccessToken("refreshed-access");

    expect(RecordingSocket.instances).toHaveLength(2);
    expect(RecordingSocket.urls[1]).toContain("access_token=refreshed-access");
  });
});
