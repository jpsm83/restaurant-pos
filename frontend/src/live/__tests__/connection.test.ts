import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLiveConnection,
  subscribeLiveNotifications,
  syncLiveConnection,
} from "../connection";
import { HarnessSocket, liveAckAndBecomeLive } from "./socketHarness";
import { installTestLiveConnection } from "@/test/installTestLiveConnection";

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
    installTestLiveConnection({
      WebSocket: RecordingSocket,
      requestTicket: (token) => `ticket-${token}`,
    });
  });

  afterEach(() => {
    installTestLiveConnection();
  });

  it("does not open a connection for a guest (no access session)", () => {
    syncLiveConnection(null);

    expect(RecordingSocket.instances).toHaveLength(0);
  });

  it("opens the live connection with the access session just received", () => {
    syncLiveConnection("just-signed-in");

    expect(RecordingSocket.instances).toHaveLength(1);
    expect(RecordingSocket.urls[0]).toContain(
      "/api/v1/notifications/live?ticket=ticket-just-signed-in",
    );
    expect(RecordingSocket.urls[0]).not.toContain("access_token");
  });

  it("does not open a socket when the ticket exchange fails", () => {
    const connection = createLiveConnection({
      WebSocket: RecordingSocket,
      requestTicket: () => null,
      scheduleReconnect: () => undefined,
    });

    connection.sync("session-token");

    expect(RecordingSocket.instances).toHaveLength(0);
    expect(connection.canCommitWrite()).toBe(false);
    expect(connection.getStatus()).toBe("disconnected");
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
    expect(RecordingSocket.urls[0]).toContain("ticket=ticket-old-token");
    expect(RecordingSocket.instances[0]?.closed).toBe(false);

    RecordingSocket.instances[0]?.close();
    syncLiveConnection("refreshed-token");

    expect(RecordingSocket.instances).toHaveLength(2);
    expect(RecordingSocket.urls[1]).toContain("ticket=ticket-refreshed-token");
  });

  it("lets two clients each hold their own live connection", () => {
    const first = createLiveConnection({
      WebSocket: RecordingSocket,
      requestTicket: (token) => `ticket-${token}`,
    });
    const second = createLiveConnection({
      WebSocket: RecordingSocket,
      requestTicket: (token) => `ticket-${token}`,
    });

    first.sync("tab-one");
    second.sync("tab-two");

    expect(RecordingSocket.instances).toHaveLength(2);
    expect(RecordingSocket.urls[0]).toContain("ticket=ticket-tab-one");
    expect(RecordingSocket.urls[1]).toContain("ticket=ticket-tab-two");

    first.close();
    expect(RecordingSocket.instances[0]?.closed).toBe(true);
    expect(RecordingSocket.instances[1]?.closed).toBe(false);
  });
});

describe("live notification events", () => {
  beforeEach(() => {
    HarnessSocket.reset();
    installTestLiveConnection({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
    });
  });

  afterEach(() => {
    installTestLiveConnection();
    HarnessSocket.reset();
  });

  const event = {
    notificationId: "n1",
    businessId: "b1",
    notificationType: "Info",
    correlationId: "corr-1",
    content: { kind: "text", text: "Your order is ready." },
  };

  const createHarnessConnection = () =>
    createLiveConnection({
      WebSocket: HarnessSocket,
      requestTicket: (token) => `ticket-${token}`,
    });

  it("delivers a parsed notification.created event to subscribers", () => {
    const listener = vi.fn();
    subscribeLiveNotifications(listener);
    syncLiveConnection("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());

    const socket = HarnessSocket.latest();
    socket.emitMessage({
      type: "notification.created",
      data: event,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(event);
  });

  it("does not deliver the live.connected acknowledgement as a notification event", () => {
    const listener = vi.fn();
    const connection = createHarnessConnection();
    connection.subscribeNotifications(listener);
    connection.sync("session-token");

    liveAckAndBecomeLive(HarnessSocket.latest());

    expect(connection.getStatus()).toBe("live");
    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores malformed and unrelated server messages", () => {
    const listener = vi.fn();
    const connection = createHarnessConnection();
    connection.subscribeNotifications(listener);
    connection.sync("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());

    const socket = HarnessSocket.latest();
    socket.emitMessage("{not json");
    socket.emitMessage({ type: "order.updated", data: { orderId: "o1" } });
    socket.emitMessage({ type: "notification.created" });
    socket.emitMessage({
      type: "notification.created",
      data: { notificationId: "n1" },
    });

    expect(listener).not.toHaveBeenCalled();
    expect(connection.getStatus()).toBe("live");
  });

  it("stops delivering events after the subscriber unsubscribes", () => {
    const listener = vi.fn();
    const connection = createHarnessConnection();
    const unsubscribe = connection.subscribeNotifications(listener);
    connection.sync("session-token");
    liveAckAndBecomeLive(HarnessSocket.latest());

    unsubscribe();
    HarnessSocket.latest().emitMessage({
      type: "notification.created",
      data: event,
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
