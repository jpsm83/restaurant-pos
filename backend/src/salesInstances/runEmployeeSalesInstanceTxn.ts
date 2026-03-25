import type { ClientSession } from "mongoose";
import { runTxnWithTransientRetry } from "../mongo/runTxnWithTransientRetry.ts";

export type EmployeeSalesTxnResult =
  | { kind: "committed" }
  | { kind: "created"; doc: unknown }
  | { kind: "response"; status: number; body: Record<string, unknown> };

/**
 * Employee "open table" transactional work with transient-error retries.
 */
export async function runEmployeeSalesInstanceTxn(
  run: (session: ClientSession) => Promise<EmployeeSalesTxnResult>,
): Promise<EmployeeSalesTxnResult> {
  const out = await runTxnWithTransientRetry(async (session) => {
    const r = await run(session);
    if (r.kind === "response") {
      return { type: "http", status: r.status, body: r.body };
    }
    return { type: "commit", value: r };
  });
  if (out.type === "http") {
    return { kind: "response", status: out.status, body: out.body };
  }
  return out.value;
}
