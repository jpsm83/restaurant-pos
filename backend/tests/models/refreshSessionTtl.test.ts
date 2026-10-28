import { beforeAll, describe, expect, it } from "vitest";

import RefreshSession from "../../src/models/refreshSession.ts";

interface ListedIndex {
  key?: Record<string, unknown>;
  expireAfterSeconds?: number;
}

describe("RefreshSession retention", () => {
  beforeAll(async () => {
    await RefreshSession.syncIndexes();
  });

  it("expires session rows through a TTL index on expiresAt", async () => {
    const indexes = (await RefreshSession.collection
      .listIndexes()
      .toArray()) as unknown as ListedIndex[];

    const ttlIndex = indexes.find((index) => index.key?.expiresAt === 1);

    expect(ttlIndex?.expireAfterSeconds).toBe(0);
  });
});
