type TelemetryCounters = {
  actorUpdateSuccesses: number;
  actorUpdateFailures: number;
  idempotencySkips: number;
  aggregateMismatchChecks: number;
  aggregateMismatches: number;
};

const counters: TelemetryCounters = {
  actorUpdateSuccesses: 0,
  actorUpdateFailures: 0,
  idempotencySkips: 0,
  aggregateMismatchChecks: 0,
  aggregateMismatches: 0,
};

const logCounters = (event: string, meta?: Record<string, unknown>) => {
  console.info(
    "[daily-sales-rollout-telemetry]",
    event,
    JSON.stringify({
      ...counters,
      ...(meta ?? {}),
    }),
  );
};

export const recordActorUpdateSuccess = (meta?: Record<string, unknown>) => {
  counters.actorUpdateSuccesses += 1;
  logCounters("actor_update_success", meta);
};

export const recordActorUpdateFailure = (meta?: Record<string, unknown>) => {
  counters.actorUpdateFailures += 1;
  logCounters("actor_update_failure", meta);
};

export const recordIdempotencySkip = (
  count = 1,
  meta?: Record<string, unknown>,
) => {
  counters.idempotencySkips += count;
  logCounters("idempotency_skip", { skippedCount: count, ...(meta ?? {}) });
};

export const recordAggregateMismatchCheck = (
  mismatch: boolean,
  meta?: Record<string, unknown>,
) => {
  counters.aggregateMismatchChecks += 1;
  if (mismatch) counters.aggregateMismatches += 1;
  logCounters("aggregate_mismatch_check", { mismatch, ...(meta ?? {}) });
};

