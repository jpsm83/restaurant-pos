import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLiveConnection,
  resetLiveConnectionForTests,
  syncLiveConnection,
} from "../connection";

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

describe("live connection", () => {
  beforeEach(() => {
    RecordingSocket.reset();
    resetLiveConnectionForTests({ WebSocket: RecordingSocket });
  });

  afterEach(() => {
    resetLiveConnectionForTests();
  });

  it("does not open a connection for a guest (no access session)", () => {
    syncLiveConnection(null);

    expect(RecordingSocket.instances).toHaveLength(0);
  });

  it("opens the live connection with the access session just received", () => {
    syncLiveConnection("just-signed-in");

    expect(RecordingSocket.instances).toHaveLength(1);
    expect(RecordingSocket.urls[0]).toContain(
      "/api/v1/notifications/live?access_token=just-signed-in",
    );
  });

  it("closes the connection on sign-out", () => {
    syncLiveConnection("session-token");
    const socket = RecordingSocket.instances[0];

    syncLiveConnection(null);

    expect(socket?.closed).toBe(true);
    expect(RecordingSocket.instances).toHaveLength(1);
  });

  it("uses a refreshed access session on the next connect", () => {
    syncLiveConnection("old-token");
    syncLiveConnection("refreshed-token");

    expect(RecordingSocket.instances).toHaveLength(1);
    expect(RecordingSocket.urls[0]).toContain("access_token=old-token");
    expect(RecordingSocket.instances[0]?.closed).toBe(false);

    RecordingSocket.instances[0]?.close();
    syncLiveConnection("refreshed-token");

    expect(RecordingSocket.instances).toHaveLength(2);
    expect(RecordingSocket.urls[1]).toContain("access_token=refreshed-token");
  });

  it("lets two clients each hold their own live connection", () => {
    const first = createLiveConnection({ WebSocket: RecordingSocket });
    const second = createLiveConnection({ WebSocket: RecordingSocket });

    first.sync("tab-one");
    second.sync("tab-two");

    expect(RecordingSocket.instances).toHaveLength(2);
    expect(RecordingSocket.urls[0]).toContain("access_token=tab-one");
    expect(RecordingSocket.urls[1]).toContain("access_token=tab-two");

    first.close();
    expect(RecordingSocket.instances[0]?.closed).toBe(true);
    expect(RecordingSocket.instances[1]?.closed).toBe(false);
  });
});
