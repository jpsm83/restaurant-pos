import {
  createLiveConnection,
  installLiveConnection,
  type LiveConnectionOptions,
} from "@/live/connection";

/** Install a fresh app-wide live connection for a test. */
export function installTestLiveConnection(
  options: LiveConnectionOptions = {},
): void {
  installLiveConnection(createLiveConnection(options));
}
