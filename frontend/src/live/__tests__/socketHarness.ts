/**
 * Controllable WebSocket stand-in for live-connection tests.
 * Starts connecting; the test opens, acks, or closes it.
 */

export class HarnessSocket {
  static urls: string[] = [];
  static instances: HarnessSocket[] = [];

  readyState = 0;
  closed = false;
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  private readonly listeners = new Map<string, Set<(event?: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    HarnessSocket.urls.push(url);
    HarnessSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event?: unknown) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event?: unknown) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
    this.emit("open");
  }

  ack(accountId = "acct-1") {
    const event = {
      data: JSON.stringify({ type: "live.connected", data: { accountId } }),
    };
    this.onmessage?.(event);
    this.emit("message", event);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
    this.emit("close");
  }

  /** Server heartbeat terminate — same close the browser sees. */
  heartbeatDie() {
    this.close();
  }

  static reset() {
    HarnessSocket.urls = [];
    HarnessSocket.instances = [];
  }

  static latest(): HarnessSocket {
    const socket = HarnessSocket.instances.at(-1);
    if (!socket) throw new Error("Expected a HarnessSocket instance");
    return socket;
  }

  private emit(type: string, event?: unknown) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

export function liveAckAndBecomeLive(socket: HarnessSocket) {
  socket.open();
  socket.ack();
}
