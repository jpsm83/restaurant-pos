import { describe, expect, it } from "vitest";
import {
  buildTablePersistenceKeyPrefix,
  createPersistenceAdapter,
} from "../persistenceService";

describe("advancedTable persistenceService", () => {
  it("builds deterministic key prefix", () => {
    const prefix = buildTablePersistenceKeyPrefix({
      appId: "app",
      screenId: "dashboard",
      tableId: "orders",
    });
    expect(prefix).toBe("app:advanced-table:dashboard:orders");
  });

  it("saves/loads/removes values from localStorage adapter", () => {
    const adapter = createPersistenceAdapter("localStorage");
    const key = "table:state";

    adapter.save(key, { page: 2 });
    expect(adapter.load(key, { page: 1 })).toEqual({ page: 2 });

    adapter.remove(key);
    expect(adapter.load(key, { page: 1 })).toEqual({ page: 1 });
  });

  it("returns fallback for invalid JSON payload", () => {
    const adapter = createPersistenceAdapter("localStorage");
    localStorage.setItem("bad-json", "{not json");

    expect(adapter.load("bad-json", { ok: true })).toEqual({ ok: true });
  });
});
