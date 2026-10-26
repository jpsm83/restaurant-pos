/**
 * Inventories Routes Tests - Phase 1 Module 9 + Phase 4 Task 4.2
 * Tests for inventories CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests for inventory period creation (requires replica set)
 *
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Inventory from "../../src/models/inventory.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Supplier from "../../src/models/supplier.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import AuditEntry from "../../src/models/auditEntry.ts";
import {
  AUDIT_ACT_KINDS,
  AUDIT_ACTOR_KINDS,
  AUDIT_RETENTION_CLASSES,
  AUDIT_TARGET_KINDS,
} from "../../src/audit/auditCatalogue.ts";

const appendAuditEntryMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/audit/appendAuditEntry.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/audit/appendAuditEntry.ts")>();
  appendAuditEntryMock.mockImplementation(actual.appendAuditEntry);
  return { ...actual, appendAuditEntry: appendAuditEntryMock };
});

// A synthetic retired code proves the HTTP rejection without retiring a product
// code in this slice.
vi.mock("restaurant-pos-packages/operationalReasons", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("restaurant-pos-packages/operationalReasons")
    >();
  const catalogues = {
    ...actual.OPERATIONAL_REASON_CATALOGUES,
    countReedit: [
      ...actual.OPERATIONAL_REASON_CATALOGUES.countReedit,
      {
        code: "retiredCountReeditReason",
        label: "Retired count re-edit reason",
        retired: true,
        allowsNote: false,
      },
    ],
  };

  return {
    ...actual,
    OPERATIONAL_REASON_CATALOGUES: catalogues,
    resolveOperationalReason: (
      act: string | null | undefined,
      code: string | null | undefined,
      note?: string | null,
    ) => actual.resolveOperationalReason(act, code, note, catalogues),
  };
});

const expectProblem = (
  response: {
    statusCode: number;
    headers: Record<string, unknown>;
    json: () => any;
  },
  status: number,
  typeSlug: string,
) => {
  expect(response.statusCode).toBe(status);
  expect(response.headers["content-type"]).toContain("application/problem+json");
  const body = response.json();
  expect(body.type).toBe(`https://restaurant-pos.app/errors/${typeSlug}`);
  expect(body.status).toBe(status);
  return body;
};

describe("Inventories Routes", () => {
  let businessId: Types.ObjectId;
  let supplierId: Types.ObjectId;
  let supplierGoodId: Types.ObjectId;

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  beforeEach(async () => {
    appendAuditEntryMock.mockClear();

    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: "TAX-001",
      currencyTrade: "USD",
      address: validAddress,
    });
    businessId = business._id;

    const supplier = await Supplier.create({
      businessId,
      tradeName: "Test Supplier",
      legalName: "Test Supplier LLC",
      email: "supplier@test.com",
      phoneNumber: "9999999999",
      taxNumber: "SUP-001",
      currentlyInUse: true,
      address: validAddress,
    });
    supplierId = supplier._id;

    const supplierGood = await SupplierGood.create({
      businessId,
      supplierId,
      name: "Test Ingredient",
      keyword: "ingredient",
      mainCategory: "Food",
      currentlyInUse: true,
      parLevel: 100,
    });
    supplierGoodId = supplierGood._id;
  });

  describe("GET /api/v1/inventories", () => {
    it("lists all inventories", async () => {
      const app = await getTestApp();

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 50,
          },
        ],
      });
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("includes soft-deleted inventories when includeDeleted=true", async () => {
      const app = await getTestApp();

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories?includeDeleted=true",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });

    it("returns a not-found problem when no inventories exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No inventories found");
    });

    it("returns a validation problem for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories?includeDeleted=maybe",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "includeDeleted" }),
        ]),
      );
    });
  });

  describe("POST /api/v1/inventories", () => {
    it("returns a validation problem for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: { businessId: "invalid-id" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a validation problem for missing businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {},
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a validation problem for a server-owned key", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {
          businessId: businessId.toString(),
          setFinalCount: true,
        },
      });

      expectProblem(response, 400, "validation");
    });
  });

  describe("GET /api/v1/inventories/:inventoryId", () => {
    it("gets inventory by ID", async () => {
      const app = await getTestApp();

      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 50,
          },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/${inventory._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(inventory._id.toString());
    });

    it("returns a validation problem for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "inventoryId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent inventory", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No inventory found");
    });

    it("returns not-found for soft-deleted inventory by default", async () => {
      const app = await getTestApp();
      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/${inventory._id}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No inventory found");
    });

    it("returns soft-deleted inventory when includeDeleted=true", async () => {
      const app = await getTestApp();
      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/${inventory._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().deleted).toBe(true);
    });
  });

  describe("DELETE /api/v1/inventories/:inventoryId", () => {
    it("returns a validation problem for an invalid inventoryId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/inventories/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "inventoryId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent inventory", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/inventories/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Inventory not found!");
    });

    it("soft-deletes inventory successfully", async () => {
      const app = await getTestApp();

      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/inventories/${inventory._id}`,
      });

      expect(response.statusCode).toBe(200);
      const deleted = await Inventory.findById(inventory._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(deleted).not.toBeNull();
      expect(deleted?.deleted).toBe(true);
    });

    it("returns conflict when inventory already deleted", async () => {
      const app = await getTestApp();
      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/inventories/${inventory._id}`,
      });

      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toBe("Inventory already deleted!");
    });
  });

  describe("PATCH /api/v1/inventories/:inventoryId/close", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${fakeId}/close`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns a validation problem for an invalid inventoryId when authenticated", async () => {
      const app = await getTestApp();
      const authorization = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "invmanager@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/inventories/invalid-id/close",
        headers: { authorization },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "inventoryId" }),
        ]),
      );
    });
  });

  describe("GET /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId", () => {
    it("returns a validation problem for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/invalid-id/supplierGood/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "inventoryId" }),
          expect.objectContaining({ path: "supplierGoodId" }),
        ]),
      );
    });

    it("returns a not-found problem when supplier good not in inventory", async () => {
      const app = await getTestApp();
      const fakeInventoryId = new Types.ObjectId();
      const fakeSupplierGoodId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/${fakeInventoryId}/supplierGood/${fakeSupplierGoodId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No inventories found!");
    });
  });

  describe("PATCH /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/addCount", () => {
    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();
      const fakeInventoryId = new Types.ObjectId();
      const fakeSupplierGoodId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${fakeInventoryId}/supplierGood/${fakeSupplierGoodId}/addCount`,
        payload: {},
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "currentCountQuantity" }),
          expect.objectContaining({ path: "countedByEmployeeId" }),
        ]),
      );
    });

    it("returns a validation problem for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/inventories/invalid-id/supplierGood/invalid-id/addCount",
        payload: {
          currentCountQuantity: 50,
          countedByEmployeeId: new Types.ObjectId().toString(),
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "inventoryId" }),
          expect.objectContaining({ path: "supplierGoodId" }),
        ]),
      );
    });
  });

  describe("PATCH /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/updateCount", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const fakeInventoryId = new Types.ObjectId();
      const fakeSupplierGoodId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${fakeInventoryId}/supplierGood/${fakeSupplierGoodId}/updateCount`,
        payload: {
          countId: new Types.ObjectId().toString(),
          reasonCode: "miscount",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns a validation problem for an invalid countId when authenticated", async () => {
      const app = await getTestApp();
      const authorization = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "invmanager@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${new Types.ObjectId()}/supplierGood/${new Types.ObjectId()}/updateCount`,
        headers: { authorization },
        payload: { countId: "not-an-id", reasonCode: "miscount" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "countId" }),
        ]),
      );
    });

    const seedCountReeditFixture = async (
      role: "Manager" | "Waiter" = "Manager",
    ) => {
      const user = await User.create({
        personalDetails: {
          username: "countreediter",
          email: "countreediter@test.com",
          password: "hashedpassword123",
          firstName: "Count",
          lastName: "Reediter",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "COUNT-REEDIT-001",
          address: validAddress,
        },
      });

      const employee = await Employee.create({
        businessId,
        userId: user._id,
        currentShiftRole: role,
        joinDate: new Date(),
        taxNumber: "COUNT-REEDIT-TAX-001",
        vacationDaysPerYear: 20,
      });

      const authorization = await generateTestToken({
        id: user._id.toString(),
        email: "countreediter@test.com",
        type: "user",
        employeeId: employee._id.toString(),
        businessId: businessId.toString(),
        canLogAsEmployee: true,
        role,
      });

      const countId = new Types.ObjectId();
      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            dynamicSystemCount: 100,
            monthlyCounts: [
              {
                _id: countId,
                currentCountQuantity: 40,
                countedByEmployeeId: employee._id,
                deviationPercent: 20,
                comments: "Original count",
                reedited: {
                  reeditedByEmployeeId: employee._id,
                  date: new Date("2026-01-01"),
                  reason: "Initial correction",
                  originalValues: {
                    currentCountQuantity: 35,
                    deviationPercent: 15,
                    dynamicSystemCount: 80,
                  },
                },
              },
            ],
          },
        ],
      });

      return { user, employee, authorization, countId, inventory };
    };

    const findStoredCount = async (
      inventoryId: Types.ObjectId,
      countId: Types.ObjectId,
    ) => {
      const inventory = await Inventory.findById(inventoryId).lean();
      return inventory?.inventoryGoods?.[0]?.monthlyCounts?.find(
        (count: { _id?: Types.ObjectId }) =>
          count._id?.toString() === countId.toString(),
      );
    };

    it("appends one audit entry when a re-edit changes the stored quantity", async () => {
      const app = await getTestApp();
      const { user, employee, authorization, countId, inventory } =
        await seedCountReeditFixture();
      const reasonCode = "goodsArrivedAfterCount";

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 55,
          reasonCode,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: "Count updated successfully!",
      });

      const entries = await AuditEntry.find({}).lean();
      expect(entries).toHaveLength(1);
      const [entry] = entries;
      expect(entry.actorKind).toBe(AUDIT_ACTOR_KINDS.USER);
      expect(String(entry.actorId)).toBe(String(user._id));
      expect(entry.actKind).toBe(AUDIT_ACT_KINDS.INVENTORY_COUNT_REEDITED);
      expect(entry.target).toEqual({
        kind: AUDIT_TARGET_KINDS.INVENTORY,
        id: inventory._id,
      });
      expect(entry.relatedTargets).toEqual(
        expect.arrayContaining([
          {
            kind: AUDIT_TARGET_KINDS.INVENTORY_COUNT,
            id: countId,
          },
          {
            kind: AUDIT_TARGET_KINDS.SUPPLIER_GOOD,
            id: supplierGoodId,
          },
        ]),
      );
      expect(String(entry.businessId)).toBe(String(businessId));
      expect(entry.payload).toEqual({
        countBefore: 40,
        countAfter: 55,
        reasonCode,
      });
      expect(entry.retentionClass).toBe(
        AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
      );
      expect(entry.impersonation).toBe(false);

      expect(appendAuditEntryMock).toHaveBeenCalledTimes(1);
      expect(appendAuditEntryMock.mock.calls[0][0].session).toBeDefined();

      const storedCount = await findStoredCount(inventory._id, countId);
      expect(storedCount?.currentCountQuantity).toBe(55);
      expect(storedCount?.reedited?.reasonCode).toBe(reasonCode);
      expect(storedCount?.reedited?.reasonNote).toBeUndefined();
      expect(String(storedCount?.reedited?.reeditedByEmployeeId)).toBe(
        String(employee._id),
      );
      expect(
        storedCount?.reedited?.originalValues.currentCountQuantity,
      ).toBe(40);
    });

    it("stores an Other note on the snapshot and the audit payload", async () => {
      const app = await getTestApp();
      const { authorization, countId, inventory } =
        await seedCountReeditFixture();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 55,
          reasonCode: "other",
          reasonNote: "  Delivery arrived after the count  ",
        },
      });

      expect(response.statusCode).toBe(200);

      const storedCount = await findStoredCount(inventory._id, countId);
      expect(storedCount?.reedited?.reasonCode).toBe("other");
      expect(storedCount?.reedited?.reasonNote).toBe(
        "Delivery arrived after the count",
      );

      const entries = await AuditEntry.find({}).lean();
      expect(entries).toHaveLength(1);
      expect(entries[0].payload).toEqual({
        countBefore: 40,
        countAfter: 55,
        reasonCode: "other",
        reasonNote: "Delivery arrived after the count",
      });
    });

    it.each([
      ["a code from another catalogue", { reasonCode: "kitchenPrepError" }],
      ["an unknown code", { reasonCode: "notARealReason" }],
      ["a retired code", { reasonCode: "retiredCountReeditReason" }],
      [
        "a note supplied with a named reason",
        { reasonCode: "miscount", reasonNote: "free text" },
      ],
    ])(
      "rejects %s and leaves the count unchanged",
      async (_label, selection) => {
        const app = await getTestApp();
        const { authorization, countId, inventory } =
          await seedCountReeditFixture();

        const response = await app.inject({
          method: "PATCH",
          url: `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`,
          headers: { authorization },
          payload: {
            countId: countId.toString(),
            currentCountQuantity: 55,
            ...selection,
          },
        });

        expectProblem(response, 400, "bad-request");
        expect(appendAuditEntryMock).not.toHaveBeenCalled();

        const storedCount = await findStoredCount(inventory._id, countId);
        expect(storedCount?.currentCountQuantity).toBe(40);
        expect(storedCount?.reedited?.reason).toBe("Initial correction");
        expect(storedCount?.reedited?.reasonCode).toBeUndefined();
      },
    );

    it("rejects a missing code and a legacy free-text reason before touching the count", async () => {
      const app = await getTestApp();
      const { authorization, countId, inventory } =
        await seedCountReeditFixture();
      const url = `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`;

      const missingCode = await app.inject({
        method: "PATCH",
        url,
        headers: { authorization },
        payload: { countId: countId.toString(), currentCountQuantity: 55 },
      });
      const missingBody = expectProblem(missingCode, 400, "validation");
      expect(missingBody.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "reasonCode" }),
        ]),
      );

      const legacyReason = await app.inject({
        method: "PATCH",
        url,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 55,
          reason: "Legacy free text",
        },
      });
      expectProblem(legacyReason, 400, "validation");

      expect(appendAuditEntryMock).not.toHaveBeenCalled();
      const storedCount = await findStoredCount(inventory._id, countId);
      expect(storedCount?.currentCountQuantity).toBe(40);
      expect(storedCount?.reedited?.reason).toBe("Initial correction");
    });

    it("keeps an older free-text audit payload readable and unchanged", async () => {
      const app = await getTestApp();
      const { user, authorization, countId, inventory } =
        await seedCountReeditFixture();
      await AuditEntry.create({
        actorKind: AUDIT_ACTOR_KINDS.USER,
        actorId: user._id,
        actKind: AUDIT_ACT_KINDS.INVENTORY_COUNT_REEDITED,
        target: {
          kind: AUDIT_TARGET_KINDS.INVENTORY,
          id: inventory._id,
        },
        relatedTargets: [
          { kind: AUDIT_TARGET_KINDS.INVENTORY_COUNT, id: countId },
        ],
        businessId,
        occurredAt: new Date("2026-01-01"),
        payload: {
          countBefore: 35,
          countAfter: 40,
          reason: "Initial correction",
        },
        retentionClass: AUDIT_RETENTION_CLASSES.LEGAL_AND_FINANCIAL,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 55,
          reasonCode: "miscount",
        },
      });
      expect(response.statusCode).toBe(200);

      const entries = await AuditEntry.find({}).lean();
      expect(entries).toHaveLength(2);
      const legacyEntry = entries.find(
        (entry) =>
          (entry.payload as { reason?: string } | undefined)?.reason ===
          "Initial correction",
      );
      expect(legacyEntry?.payload).toEqual({
        countBefore: 35,
        countAfter: 40,
        reason: "Initial correction",
      });
      const structuredEntry = entries.find(
        (entry) => entry._id !== legacyEntry?._id,
      );
      expect(structuredEntry?.payload).toEqual({
        countBefore: 40,
        countAfter: 55,
        reasonCode: "miscount",
      });
    });

    it("keeps the existing role failure unchanged", async () => {
      const app = await getTestApp();
      const { authorization, countId, inventory } =
        await seedCountReeditFixture("Waiter");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 55,
          reasonCode: "miscount",
        },
      });

      expectProblem(response, 403, "forbidden");
      expect(appendAuditEntryMock).not.toHaveBeenCalled();
      const storedCount = await findStoredCount(inventory._id, countId);
      expect(storedCount?.currentCountQuantity).toBe(40);
    });

    it("appends a second entry and leaves the first unchanged", async () => {
      const app = await getTestApp();
      const { authorization, countId, inventory } =
        await seedCountReeditFixture();
      const url = `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`;

      const first = await app.inject({
        method: "PATCH",
        url,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 55,
          reasonCode: "miscount",
        },
      });
      const second = await app.inject({
        method: "PATCH",
        url,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 60,
          reasonCode: "wrongUnit",
        },
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);

      const entries = await AuditEntry.find({}).lean();
      expect(entries).toHaveLength(2);
      expect(
        entries.map((entry) => entry.payload).sort((a, b) => {
          const left = (a as { countBefore: number }).countBefore;
          const right = (b as { countBefore: number }).countBefore;
          return left - right;
        }),
      ).toEqual([
        {
          countBefore: 40,
          countAfter: 55,
          reasonCode: "miscount",
        },
        {
          countBefore: 55,
          countAfter: 60,
          reasonCode: "wrongUnit",
        },
      ]);

      const storedCount = await findStoredCount(inventory._id, countId);
      expect(storedCount?.currentCountQuantity).toBe(60);
      expect(
        storedCount?.reedited?.originalValues.currentCountQuantity,
      ).toBe(55);
    });

    it("appends nothing and keeps the no-op response for the same quantity", async () => {
      const app = await getTestApp();
      const { authorization, countId, inventory } =
        await seedCountReeditFixture();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 40,
          reasonCode: "miscount",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: "Count is the same, no need to update!",
      });
      expect(await AuditEntry.countDocuments()).toBe(0);
      expect(appendAuditEntryMock).not.toHaveBeenCalled();

      const storedCount = await findStoredCount(inventory._id, countId);
      expect(storedCount?.currentCountQuantity).toBe(40);
      expect(storedCount?.reedited?.reason).toBe("Initial correction");
    });

    it("rolls back the re-edit and surfaces a server error when the append fails", async () => {
      const app = await getTestApp();
      const { authorization, countId, inventory } =
        await seedCountReeditFixture();
      appendAuditEntryMock.mockResolvedValueOnce({
        success: false,
        error: "audit unavailable",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${inventory._id}/supplierGood/${supplierGoodId}/updateCount`,
        headers: { authorization },
        payload: {
          countId: countId.toString(),
          currentCountQuantity: 55,
          reasonCode: "entryError",
        },
      });

      expectProblem(response, 500, "internal");
      expect(await AuditEntry.countDocuments()).toBe(0);

      const storedCount = await findStoredCount(inventory._id, countId);
      expect(storedCount?.currentCountQuantity).toBe(40);
      expect(storedCount?.reedited?.reason).toBe("Initial correction");

      const storedInventory = await Inventory.findById(inventory._id).lean();
      expect(
        storedInventory?.inventoryGoods?.[0]?.dynamicSystemCount,
      ).toBe(100);
    });
  });

  describe("GET /api/v1/inventories/business/:businessId", () => {
    it("lists inventories by business", async () => {
      const app = await getTestApp();

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("lists soft-deleted inventories by business when includeDeleted=true", async () => {
      const app = await getTestApp();

      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });

    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/business/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a not-found problem when no inventories for business", async () => {
      const app = await getTestApp();
      const otherBusinessId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${otherBusinessId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No inventories found!");
    });

    it("coerces a valid monthDate query and scopes the lookup", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}?monthDate=2024-06-15`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No inventories found!");
    });

    it("returns a validation problem for an unparseable monthDate query", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}?monthDate=not-a-date`,
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "monthDate" }),
        ]),
      );
    });
  });

  describe("GET /api/v1/inventories/business/:businessId/lowStock", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/business/invalid-id/lowStock",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns empty lowStock when no inventory", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}/lowStock`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.lowStock).toEqual([]);
    });
  });

  describe("GET /api/v1/inventories/business/:businessId/varianceReport", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/inventories/business/invalid-id/varianceReport",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a validation problem for an invalid month format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}/varianceReport?month=2024-13`,
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "month" })]),
      );
    });

    it("returns variance report", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/inventories/business/${businessId}/varianceReport`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("varianceReport");
    });
  });

  // Phase 4 Task 4.2: Transaction Tests for Inventory Period Management
  describe("Transaction Tests - POST /api/v1/inventories", () => {
    it("creates new inventory period with supplierGoods", async () => {
      const app = await getTestApp();

      // Ensure no inventory exists for current month
      await Inventory.deleteMany({ businessId });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");

      // Verify inventory was created with the supplierGood
      const createdInventory = await Inventory.findOne({ businessId }).lean();
      expect(createdInventory).not.toBeNull();
      expect(createdInventory?.setFinalCount).toBe(false);
      expect(createdInventory?.inventoryGoods?.length).toBeGreaterThanOrEqual(1);

      // Verify supplierGood is included
      const hasSupplierGood = createdInventory?.inventoryGoods?.some(
        (g: { supplierGoodId: { toString: () => string } }) =>
          g.supplierGoodId.toString() === supplierGoodId.toString()
      );
      expect(hasSupplierGood).toBe(true);
    });

    it("prevents duplicate inventory for same month", async () => {
      const app = await getTestApp();

      // Create an inventory for current month
      await Inventory.deleteMany({ businessId });
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 50,
          },
        ],
      });

      // Try to create another one
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {
          businessId: businessId.toString(),
        },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toContain("already exists");
    });

    it("closes previous month inventory when creating new period", async () => {
      const app = await getTestApp();

      // Create a previous month inventory (without monthlyCounts to avoid validation complexity)
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      await Inventory.deleteMany({ businessId });

      const previousInventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        createdAt: lastMonth,
        inventoryGoods: [
          {
            supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 75,
          },
        ],
      });

      // Create new month inventory
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/inventories",
        payload: {
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(201);

      // Verify previous month was closed
      const closedInventory = await Inventory.findById(previousInventory._id).lean();
      expect(closedInventory?.setFinalCount).toBe(true);

      // Verify new inventory was created
      const newInventory = await Inventory.findOne({
        businessId,
        _id: { $ne: previousInventory._id },
      }).lean();

      expect(newInventory).not.toBeNull();
      expect(newInventory?.setFinalCount).toBe(false);

      // The new inventory should have the supplierGood
      const supplierGoodEntry = newInventory?.inventoryGoods?.find(
        (g: { supplierGoodId: { toString: () => string } }) =>
          g.supplierGoodId.toString() === supplierGoodId.toString()
      );
      expect(supplierGoodEntry).toBeDefined();
    });
  });

  describe("Transaction Tests - PATCH close", () => {
    it("closes inventory and creates next period", async () => {
      const app = await getTestApp();

      // Create user with all required fields
      const user = await User.create({
        personalDetails: {
          username: "invmanager",
          email: "invmanager@test.com",
          password: "hashedpassword123",
          firstName: "Test",
          lastName: "Manager",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "INV-MGR-001",
          address: validAddress,
        },
      });

      const employee = await Employee.create({
        businessId,
        userId: user._id,
        currentShiftRole: "General Manager",
        joinDate: new Date(),
        taxNumber: `INV-EMP-${Date.now()}`,
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
      });

      // Create inventory to close (without monthlyCounts to avoid validation complexity)
      const inventory = await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [
          {
            supplierGoodId,
            dynamicSystemCount: 100,
          },
        ],
      });

      // Generate token for the user
      const token = await generateTestToken({
        id: user._id.toString(),
        email: "invmanager@test.com",
        type: "user",
        employeeId: employee._id.toString(),
        businessId: businessId.toString(),
        canLogAsEmployee: true,
        role: "Manager",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/inventories/${inventory._id}/close`,
        headers: { authorization: token },
      });

      expect(response.statusCode).toBe(200);

      // Verify inventory was closed
      const closedInventory = await Inventory.findById(inventory._id).lean();
      expect(closedInventory?.setFinalCount).toBe(true);

      // Verify next period inventory was created
      const nextInventory = await Inventory.findOne({
        businessId,
        _id: { $ne: inventory._id },
        setFinalCount: false,
      }).lean();

      expect(nextInventory).not.toBeNull();
    });
  });
});
