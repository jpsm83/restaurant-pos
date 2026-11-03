import { describe, it, expect, beforeAll, afterAll } from "vitest";
import User from "../../src/models/user.ts";
import {
  claimRequestCooldown,
  REQUEST_COOLDOWN_MS,
} from "../../src/auth/requestCooldown.ts";
import { resetTestApp } from "../setup.ts";

function claim(
  userId: unknown,
  requestedAt: Date = new Date(),
): Promise<boolean> {
  return claimRequestCooldown(
    User,
    { _id: userId },
    "verificationRequestedAt",
    { $set: { verificationRequestedAt: requestedAt } },
    requestedAt,
  );
}

async function createUser(email: string) {
  return User.create({ personalDetails: { email } });
}

describe("claimRequestCooldown", () => {
  beforeAll(async () => {
    await resetTestApp();
  });

  afterAll(async () => {
    await resetTestApp();
  });

  it("claims a purpose with no previous request", async () => {
    const user = await createUser("claim-fresh@example.com");
    await expect(claim(user._id)).resolves.toBe(true);
  });

  it("refuses a purpose inside the cooldown", async () => {
    const user = await createUser("claim-cooldown@example.com");
    const requestedAt = new Date();
    await User.updateOne({ _id: user._id }, { $set: { verificationRequestedAt: requestedAt } });

    await expect(claim(user._id)).resolves.toBe(false);
  });

  it("claims a purpose after the cooldown", async () => {
    const user = await createUser("claim-expired@example.com");
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          verificationRequestedAt: new Date(
            Date.now() - REQUEST_COOLDOWN_MS - 1_000,
          ),
        },
      },
    );

    await expect(claim(user._id)).resolves.toBe(true);
  });

  it("lets exactly one of two concurrent claims win", async () => {
    const user = await createUser("claim-concurrent@example.com");

    const results = await Promise.all([claim(user._id), claim(user._id)]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
