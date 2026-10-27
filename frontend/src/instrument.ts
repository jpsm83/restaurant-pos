/**
 * Loaded before the rest of the app from `main.tsx` so error monitoring is
 * ready before React mounts. Initialization itself is owned by the monitoring
 * module.
 */
import { initializeSentry } from "./monitoring/errorMonitoring";

initializeSentry();
