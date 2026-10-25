import { useSyncExternalStore } from "react";
import { getLiveStatus, subscribeLiveStatus } from "./connection";

export function useLiveConnectionStatus() {
  return useSyncExternalStore(
    subscribeLiveStatus,
    getLiveStatus,
    getLiveStatus,
  );
}
