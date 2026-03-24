import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getTestApp } from "../setup.ts";
import Notification from "../../src/models/notification.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[idx].toFixed(2));
};

const measureEndpoint = async (
  app: Awaited<ReturnType<typeof getTestApp>>,
  url: string,
  rounds = 30
): Promise<{ p50Ms: number; p95Ms: number; samples: number[] }> => {
  const samples: number[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = process.hrtime.bigint();
    const response = await app.inject({ method: "GET", url });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    expect(response.statusCode).toBe(200);
    samples.push(elapsedMs);
  }
  return { p50Ms: percentile(samples, 50), p95Ms: percentile(samples, 95), samples };
};

describe("Performance baseline - notification read endpoints", () => {
  it("captures local p50/p95 latency and explain execution stats", async () => {
    const app = await getTestApp();

    const businessA = await Business.create({
      tradeName: "Perf A",
      legalName: "Perf A LLC",
      email: `perf-a-${Date.now()}@restaurant.com`,
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: `PERF-A-${Date.now()}`,
      currencyTrade: "USD",
      subscription: "Free",
      address: {
        country: "USA",
        state: "CA",
        city: "Los Angeles",
        street: "Main St",
        buildingNumber: "1",
        postCode: "90001",
      },
    });

    const businessB = await Business.create({
      tradeName: "Perf B",
      legalName: "Perf B LLC",
      email: `perf-b-${Date.now()}@restaurant.com`,
      password: "hashedpassword",
      phoneNumber: "1234567891",
      taxNumber: `PERF-B-${Date.now()}`,
      currencyTrade: "USD",
      subscription: "Free",
      address: {
        country: "USA",
        state: "CA",
        city: "Los Angeles",
        street: "Main St",
        buildingNumber: "2",
        postCode: "90001",
      },
    });

    const targetUser = await User.create({
      personalDetails: {
        username: `perf-user-${Date.now()}`,
        email: `perf-user-${Date.now()}@test.com`,
        password: "hashedpassword",
        firstName: "Perf",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        idType: "National ID",
        idNumber: `PERF-USER-${Date.now()}`,
        address: {
          country: "USA",
          state: "CA",
          city: "Los Angeles",
          street: "Main St",
          buildingNumber: "3",
          postCode: "90001",
        },
      },
    });

    const baseCreatedAt = Date.now();
    const toCreateA = Array.from({ length: 200 }, (_, idx) => ({
      notificationType: "Info",
      message: `Perf A message ${idx}`,
      businessId: businessA._id,
      customersRecipientsIds: [targetUser._id],
      createdAt: new Date(baseCreatedAt + idx),
      updatedAt: new Date(baseCreatedAt + idx),
    }));
    const toCreateB = Array.from({ length: 120 }, (_, idx) => ({
      notificationType: "Info",
      message: `Perf B message ${idx}`,
      businessId: businessB._id,
      customersRecipientsIds: [new Types.ObjectId()],
      createdAt: new Date(baseCreatedAt + 500 + idx),
      updatedAt: new Date(baseCreatedAt + 500 + idx),
    }));

    const createdA = await Notification.insertMany(toCreateA, { ordered: true });
    await Notification.insertMany(toCreateB, { ordered: true });

    await User.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          notifications: createdA.slice(0, 120).map((n) => ({
            notificationId: n._id,
            readFlag: false,
            deletedFlag: false,
          })),
        },
      }
    );

    const [globalLatency, businessLatency, userLatency] = await Promise.all([
      measureEndpoint(app, "/api/v1/notifications?page=1&limit=20"),
      measureEndpoint(
        app,
        `/api/v1/notifications/business/${businessA._id.toString()}?page=1&limit=20`
      ),
      measureEndpoint(
        app,
        `/api/v1/notifications/user/${targetUser._id.toString()}?page=1&limit=20`
      ),
    ]);

    const globalExplain = (await Notification.find(
      {},
      "_id notificationType message businessId senderId employeesRecipientsIds customersRecipientsIds createdAt updatedAt"
    )
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .explain("executionStats")) as {
      executionStats?: { totalDocsExamined?: number };
      queryPlanner?: { winningPlan?: { inputStage?: { stage?: string }; stage?: string } };
    };

    const businessExplain = (await Notification.find(
      { businessId: businessA._id },
      "_id notificationType message businessId senderId employeesRecipientsIds customersRecipientsIds createdAt updatedAt"
    )
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .explain("executionStats")) as {
      executionStats?: { totalDocsExamined?: number };
      queryPlanner?: { winningPlan?: { inputStage?: { stage?: string }; stage?: string } };
    };

    const userInboxIds = createdA.slice(0, 50).map((n) => n._id);
    const userExplain = (await Notification.find(
      { _id: { $in: userInboxIds } },
      "_id notificationType message businessId senderId employeesRecipientsIds customersRecipientsIds createdAt updatedAt"
    )
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .explain("executionStats")) as {
      executionStats?: { totalDocsExamined?: number };
      queryPlanner?: { winningPlan?: { inputStage?: { stage?: string }; stage?: string } };
    };

    const result = {
      latencyMs: {
        globalList: { p50: globalLatency.p50Ms, p95: globalLatency.p95Ms },
        businessList: { p50: businessLatency.p50Ms, p95: businessLatency.p95Ms },
        userList: { p50: userLatency.p50Ms, p95: userLatency.p95Ms },
      },
      executionStats: {
        globalList: {
          totalDocsExamined: globalExplain.executionStats?.totalDocsExamined ?? -1,
          winningStage:
            globalExplain.queryPlanner?.winningPlan?.inputStage?.stage ??
            globalExplain.queryPlanner?.winningPlan?.stage ??
            "unknown",
        },
        businessList: {
          totalDocsExamined: businessExplain.executionStats?.totalDocsExamined ?? -1,
          winningStage:
            businessExplain.queryPlanner?.winningPlan?.inputStage?.stage ??
            businessExplain.queryPlanner?.winningPlan?.stage ??
            "unknown",
        },
        userList: {
          totalDocsExamined: userExplain.executionStats?.totalDocsExamined ?? -1,
          winningStage:
            userExplain.queryPlanner?.winningPlan?.inputStage?.stage ??
            userExplain.queryPlanner?.winningPlan?.stage ??
            "unknown",
        },
      },
      dataset: {
        totalNotifications: toCreateA.length + toCreateB.length,
        businessANotifications: toCreateA.length,
        businessBNotifications: toCreateB.length,
        userInboxRefs: 120,
      },
    };

    const outputPath = resolve(
      process.cwd(),
      "src/communications/NOTIFICATIONS_PERFORMANCE_BASELINE_SNAPSHOT.json"
    );
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

    expect(result.latencyMs.businessList.p95).toBeGreaterThan(0);
    expect(result.latencyMs.userList.p95).toBeGreaterThan(0);
    expect(result.executionStats.businessList.totalDocsExamined).toBeGreaterThan(0);
  });
});
