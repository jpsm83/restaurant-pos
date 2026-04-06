/**
 * Sparse indexes on auth-email token fields (User + Business).
 */
import { describe, it, expect, beforeAll } from "vitest";
import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";

async function listIndexSpecs(collection: {
  listIndexes: () => { toArray: () => Promise<Record<string, unknown>[]> };
}) {
  return collection.listIndexes().toArray();
}

function findSparseSingleFieldIndex(
  indexes: Record<string, unknown>[],
  field: string,
): Record<string, unknown> | undefined {
  return indexes.find((ix) => {
    const key = ix.key as Record<string, number> | undefined;
    if (!key || typeof key !== "object") return false;
    const keys = Object.keys(key);
    return keys.length === 1 && keys[0] === field && key[field] === 1;
  });
}

describe("Auth email security indexes", () => {
  beforeAll(async () => {
    await User.syncIndexes();
    await Business.syncIndexes();
  });

  it("User defines sparse indexes on verificationToken and resetPasswordToken", async () => {
    const indexes = await listIndexSpecs(User.collection);
    const confirmIx = findSparseSingleFieldIndex(indexes, "verificationToken");
    const resetIx = findSparseSingleFieldIndex(indexes, "resetPasswordToken");

    expect(confirmIx).toBeDefined();
    expect(confirmIx?.sparse).toBe(true);
    expect(resetIx).toBeDefined();
    expect(resetIx?.sparse).toBe(true);
  });

  it("Business defines sparse indexes on verificationToken and resetPasswordToken", async () => {
    const indexes = await listIndexSpecs(Business.collection);
    const confirmIx = findSparseSingleFieldIndex(indexes, "verificationToken");
    const resetIx = findSparseSingleFieldIndex(indexes, "resetPasswordToken");

    expect(confirmIx).toBeDefined();
    expect(confirmIx?.sparse).toBe(true);
    expect(resetIx).toBeDefined();
    expect(resetIx?.sparse).toBe(true);
  });
});
