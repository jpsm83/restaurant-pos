/**
 * createOrders SalesInstance validation — Task 12
 * Inventory deduction is mocked; focus is business + closed checks.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import Business from "../../src/models/business.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import User from "../../src/models/user.ts";
import createOrders from "../../src/orders/createOrders.ts";

vi.mock("../../src/inventories/updateDynamicCountSupplierGood.ts", () => ({
  default: vi.fn(async () => true as const),
}));

describe.sequential("createOrders validation", () => {
  let businessId: Types.ObjectId;
  let otherBusinessId: Types.ObjectId;
  let salesPointId: Types.ObjectId;
  let salesInstanceId: Types.ObjectId;
  let businessGoodId: Types.ObjectId;
  let userId: Types.ObjectId;

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Ord Val Biz",
      legalName: "Ord Val LLC",
      email: `ordval-${Date.now()}@test.com`,
      password: "hashed",
      phoneNumber: "111",
      taxNumber: `TAX-ORD-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      currencyTrade: "USD",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main",
        buildingNumber: "1",
        postCode: "90001",
      },
    });
    businessId = business._id;

    const other = await Business.create({
      tradeName: "Other Biz",
      legalName: "Other LLC",
      email: `other-${Date.now()}@test.com`,
      password: "hashed",
      phoneNumber: "112",
      taxNumber: `TAX-OTH-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      currencyTrade: "USD",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main",
        buildingNumber: "1",
        postCode: "90001",
      },
    });
    otherBusinessId = other._id;

    const sp = await SalesPoint.create({
      businessId,
      salesPointName: "Counter",
      salesPointType: "Counter",
    });
    salesPointId = sp._id;

    const si = await SalesInstance.create({
      businessId,
      salesPointId,
      dailyReferenceNumber: 1,
      guests: 2,
      salesInstanceStatus: "Occupied",
      openedAsRole: "employee",
    });
    salesInstanceId = si._id;

    const good = await BusinessGood.create({
      businessId,
      name: "Item",
      keyword: "item",
      mainCategory: "Food",
      onMenu: true,
      available: true,
      sellingPrice: 10,
      costPrice: 3,
    });
    businessGoodId = good._id;

    const user = await User.create({
      personalDetails: {
        email: `orduser-${Date.now()}@test.com`,
        password: "hashed",
        firstName: "O",
        lastName: "U",
        phoneNumber: "333",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main",
          buildingNumber: "1",
          postCode: "90001",
        },
        idNumber: "ID",
        idType: "Passport",
        username: "ou",
      },
      allUserRoles: ["Customer"],
    });
    userId = user._id;
  });

  const minimalOrder = () => ({
    businessGoodId,
    orderGrossPrice: 10,
    orderNetPrice: 10,
    orderCostPrice: 3,
  });

  it("rejects when SalesInstance businessId does not match payload businessId", async () => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await createOrders(
        "1",
        [minimalOrder()],
        userId,
        "employee",
        salesInstanceId,
        otherBusinessId,
        session,
      );
      expect(result).toBe("SalesInstance not found for this business!");
    } finally {
      await session.abortTransaction();
      session.endSession();
    }
  });

  it("rejects when SalesInstance is closed", async () => {
    await SalesInstance.updateOne(
      { _id: salesInstanceId },
      { $set: { salesInstanceStatus: "Closed" } },
    );

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await createOrders(
        "1",
        [minimalOrder()],
        userId,
        "employee",
        salesInstanceId,
        businessId,
        session,
      );
      expect(result).toBe("SalesInstance is closed!");
    } finally {
      await session.abortTransaction();
      session.endSession();
    }
  });

  it("rejects when SalesPoint does not belong to payload businessId", async () => {
    const alienPoint = await SalesPoint.create({
      businessId: otherBusinessId,
      salesPointName: "Alien",
      salesPointType: "Table",
    });
    await SalesInstance.updateOne(
      { _id: salesInstanceId },
      { $set: { salesPointId: alienPoint._id } },
    );

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await createOrders(
        "1",
        [minimalOrder()],
        userId,
        "employee",
        salesInstanceId,
        businessId,
        session,
      );
      expect(result).toBe("SalesPoint not found for this business!");
    } finally {
      await session.abortTransaction();
      session.endSession();
    }
  });
});
