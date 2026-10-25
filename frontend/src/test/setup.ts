import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class SilentTestWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState = SilentTestWebSocket.OPEN;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    this.readyState = SilentTestWebSocket.CLOSED;
  }

  send() {}
  addEventListener() {}
  removeEventListener() {}
}

vi.stubGlobal("WebSocket", SilentTestWebSocket);

// jsdom does not implement some browser APIs Radix relies on.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
