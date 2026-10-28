/**
 * Sale and cancellation stock movement when a recipe names a soft-deleted
 * good, and when a deleted inventory sits beside the open one.
 * Orders route tests mock the stock update; this file uses the real path.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Business from "../../src/models/business.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import Employee from "../../src/models/employee.ts";
import Inventory from "../../src/models/inventory.ts";
import Order from "../../src/models/order.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import Supplier from "../../src/models/supplier.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import User from "../../src/models/user.ts";

const address = {
  country: "USA",
  state: "CA",
  city: "LA",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

describe("Stock movement and soft-deleted recipe goods", () => {
  let businessId: Types.ObjectId;
  let salesInstanceId: Types.ObjectId;
  let recipeGoodId: Types.ObjectId;
  let comboGoodId: Types.ObjectId;
  let retiredInventoryId: Types.ObjectId;
  let activeInventoryId: Types.ObjectId;
  let auth: string;
  let managerAuth: string;

  const countOf = async (inventoryId: Types.ObjectId) => {
    const inventory = await Inventory.findById(inventoryId)
      .setOptions({ includeDeleted: true })
      .lean();
    return inventory?.inventoryGoods?.[0]?.dynamicSystemCount;
  };

  const sell = async (businessGoodId: Types.ObjectId) => {
    const app = await getTestApp();
    return app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: auth },
      payload: {
        ordersArr: [
          {
            businessGoodId: businessGoodId.toString(),
            orderGrossPrice: 12.99,
            orderNetPrice: 12.99,
            orderCostPrice: 4,
          },
        ],
        salesInstanceId: salesInstanceId.toString(),
        businessId: businessId.toString(),
        dailyReferenceNumber: 1,
      },
    });
  };

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Stock Restaurant",
      legalName: "Stock Restaurant LLC",
      email: "stock@restaurant.com",
      phoneNumber: "1234567890",
      taxNumber: "TAX-STOCK",
      currencyTrade: "USD",
      address,
    });
    businessId = business._id;

    const supplier = await Supplier.create({
      businessId,
      tradeName: "Flour Mill",
      legalName: "Flour Mill LLC",
      email: "mill@test.com",
      phoneNumber: "9999999999",
      taxNumber: "SUP-STOCK",
      currentlyInUse: true,
      address,
    });
    const supplierGood = await SupplierGood.create({
      businessId,
      supplierId: supplier._id,
      name: "Flour",
      keyword: "flour",
      mainCategory: "Food",
      currentlyInUse: true,
      measurementUnit: "kg",
      pricePerMeasurementUnit: 3,
      parLevel: 10,
      deleted: true,
      deletedAt: new Date(),
    });

    const retiredInventory = await Inventory.create({
      businessId,
      setFinalCount: false,
      deleted: true,
      deletedAt: new Date(),
      inventoryGoods: [
        {
          supplierGoodId: supplierGood._id,
          dynamicSystemCount: 40,
          monthlyCounts: [],
        },
      ],
    });
    retiredInventoryId = retiredInventory._id;

    const activeInventory = await Inventory.create({
      businessId,
      setFinalCount: false,
      inventoryGoods: [
        {
          supplierGoodId: supplierGood._id,
          dynamicSystemCount: 10,
          monthlyCounts: [],
        },
      ],
    });
    activeInventoryId = activeInventory._id;

    const recipe = await BusinessGood.create({
      businessId,
      name: "Retired dough",
      keyword: "retired-dough",
      mainCategory: "Food",
      sellingPrice: 12.99,
      deleted: true,
      deletedAt: new Date(),
      ingredients: [
        {
          supplierGoodId: supplierGood._id,
          measurementUnit: "g",
          requiredQuantity: 500,
        },
      ],
    });
    recipeGoodId = recipe._id;

    const combo = await BusinessGood.create({
      businessId,
      name: "Combo meal",
      keyword: "combo-meal",
      mainCategory: "Food",
      sellingPrice: 12.99,
      setMenuIds: [recipe._id],
    });
    comboGoodId = combo._id;

    const salesPoint = await SalesPoint.create({
      businessId,
      salesPointName: "Main Counter",
      salesPointType: "Counter",
    });
    const salesInstance = await SalesInstance.create({
      businessId,
      salesPointId: salesPoint._id,
      dailyReferenceNumber: 1,
      guests: 2,
      salesInstanceStatus: "Occupied",
    });
    salesInstanceId = salesInstance._id;

    const user = await User.create({
      personalDetails: {
        email: "stock-user@test.com",
        password: "hashedpassword",
        firstName: "Stock",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        address,
        idNumber: "ID-STOCK",
        idType: "Passport",
        username: "stockuser",
      },
      allUserRoles: ["Customer"],
    });
    auth = await generateTestToken({
      id: String(user._id),
      email: "stock-user@test.com",
      type: "user",
      role: "Customer",
    });

    const manager = await User.create({
      personalDetails: {
        email: "stock-manager@test.com",
        password: "hashedpassword",
        firstName: "Stock",
        lastName: "Manager",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        address,
        idNumber: "ID-STOCK-MGR",
        idType: "Passport",
        username: "stockmanager",
      },
      allUserRoles: ["Manager"],
    });
    await Employee.create({
      businessId,
      userId: manager._id,
      allEmployeeRoles: ["Manager"],
      taxNumber: "MGR-STOCK",
      joinDate: new Date(),
      active: true,
      onDuty: true,
      vacationDaysPerYear: 20,
    });
    managerAuth = await generateTestToken({
      id: String(manager._id),
      email: "stock-manager@test.com",
      type: "user",
      role: "Manager",
    });
  });

  it("sells a soft-deleted recipe and moves only the active inventory", async () => {
    const response = await sell(recipeGoodId);

    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().message).toBe("Order created");
    expect(await countOf(activeInventoryId)).toBe(9.5);
    expect(await countOf(retiredInventoryId)).toBe(40);
  });

  it("sells a combo whose component is soft-deleted and moves only the active inventory", async () => {
    const response = await sell(comboGoodId);

    expect(response.statusCode, response.body).toBe(201);
    expect(await countOf(activeInventoryId)).toBe(9.5);
    expect(await countOf(retiredInventoryId)).toBe(40);
  });

  it("cancels that sale and restores only the active inventory", async () => {
    const app = await getTestApp();
    const created = await sell(recipeGoodId);
    expect(created.statusCode, created.body).toBe(201);

    const order = await Order.findOne({ salesInstanceId }).lean();
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/orders/${order?._id}`,
      headers: { authorization: managerAuth },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().message).toBe("Order deleted successfully!");
    expect(await countOf(activeInventoryId)).toBe(10);
    expect(await countOf(retiredInventoryId)).toBe(40);

    const retained = await Order.findById(order?._id)
      .setOptions({ includeDeleted: true })
      .lean();
    expect(retained).toBeNull();
  });

  it("moves a sale onto the open inventory when a closed period still holds the line", async () => {
    const retired = await Inventory.findById(retiredInventoryId)
      .setOptions({ includeDeleted: true })
      .lean();
    const supplierGoodId = retired?.inventoryGoods?.[0]?.supplierGoodId;
    await Inventory.deleteOne({ _id: activeInventoryId });
    const closed = await Inventory.create({
      businessId,
      setFinalCount: true,
      inventoryGoods: [
        {
          supplierGoodId,
          dynamicSystemCount: 100,
          monthlyCounts: [],
        },
      ],
    });
    const open = await Inventory.create({
      businessId,
      setFinalCount: false,
      inventoryGoods: [
        {
          supplierGoodId,
          dynamicSystemCount: 10,
          monthlyCounts: [],
        },
      ],
    });

    const response = await sell(recipeGoodId);

    expect(response.statusCode, response.body).toBe(201);
    expect(await countOf(open._id)).toBe(9.5);
    expect(await countOf(closed._id)).toBe(100);
    expect(await countOf(retiredInventoryId)).toBe(40);
  });

  it("completes a sale of a soft-deleted recipe when the only inventory is deleted", async () => {
    await Inventory.deleteOne({ _id: activeInventoryId });

    const response = await sell(recipeGoodId);

    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().message).toBe("Order created");
    expect(await countOf(retiredInventoryId)).toBe(40);
  });

  it("refuses a sale when a live supplier good has no open inventory line", async () => {
    const supplier = await Supplier.findOne({ businessId }).lean();
    const liveGood = await SupplierGood.create({
      businessId,
      supplierId: supplier?._id,
      name: "Salt",
      keyword: "salt",
      mainCategory: "Food",
      currentlyInUse: true,
      measurementUnit: "kg",
      pricePerMeasurementUnit: 1,
      parLevel: 5,
    });
    const plate = await BusinessGood.create({
      businessId,
      name: "Salted plate",
      keyword: "salted-plate",
      mainCategory: "Food",
      sellingPrice: 12.99,
      ingredients: [
        {
          supplierGoodId: liveGood._id,
          measurementUnit: "kg",
          requiredQuantity: 1,
        },
      ],
    });

    const response = await sell(plate._id);

    expect(response.statusCode, response.body).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().detail).toContain("Inventory not found!");
    expect(await countOf(activeInventoryId)).toBe(10);
    expect(await countOf(retiredInventoryId)).toBe(40);
  });
});
