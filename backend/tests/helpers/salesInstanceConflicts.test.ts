/**
 * Sales instance conflict helpers — Task 12
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import Business from "../../src/models/business.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import User from "../../src/models/user.ts";
import {
  pointBusyForEmployee,
  pointBusyForCustomerSelfOrder,
} from "../../src/salesInstances/salesInstanceConflicts.ts";

describe("salesInstanceConflicts helpers", () => {
  let businessId: Types.ObjectId;
  let salesPointId: Types.ObjectId;
  let userId: Types.ObjectId;

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Conflict Test Biz",
      legalName: "Conflict Test LLC",
      email: "conflict@test.com",
      password: "hashed",
      phoneNumber: "111",
      taxNumber: `TAX-CNF-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

    const sp = await SalesPoint.create({
      businessId,
      salesPointName: "T1",
      salesPointType: "Table",
    });
    salesPointId = sp._id;

    const user = await User.create({
      personalDetails: {
        email: `u-${Date.now()}@test.com`,
        password: "hashed",
        firstName: "U",
        lastName: "T",
        phoneNumber: "222",
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
        username: "utest",
      },
      allUserRoles: ["Customer"],
    });
    userId = user._id;
  });

  it("pointBusyForEmployee is false when no open employee instance exists", async () => {
    const busy = await pointBusyForEmployee({ salesPointId, businessId });
    expect(busy).toBe(false);
  });

  it("pointBusyForEmployee is false when only a customer-open instance exists", async () => {
    await SalesInstance.create({
      businessId,
      salesPointId,
      dailyReferenceNumber: 1,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedByUserId: userId,
      openedAsRole: "customer",
    });

    const busy = await pointBusyForEmployee({ salesPointId, businessId });
    expect(busy).toBe(false);
  });

  it("pointBusyForEmployee is true when an employee-open non-closed instance exists", async () => {
    await SalesInstance.create({
      businessId,
      salesPointId,
      dailyReferenceNumber: 1,
      guests: 2,
      salesInstanceStatus: "Occupied",
      openedByUserId: userId,
      openedAsRole: "employee",
    });

    const busy = await pointBusyForEmployee({ salesPointId, businessId });
    expect(busy).toBe(true);
  });

  it("pointBusyForEmployee ignores closed employee instances", async () => {
    await SalesInstance.create({
      businessId,
      salesPointId,
      dailyReferenceNumber: 1,
      guests: 2,
      salesInstanceStatus: "Closed",
      openedByUserId: userId,
      openedAsRole: "employee",
    });

    const busy = await pointBusyForEmployee({ salesPointId, businessId });
    expect(busy).toBe(false);
  });

  it("pointBusyForCustomerSelfOrder matches employee-open busy rule", async () => {
    expect(
      await pointBusyForCustomerSelfOrder({ salesPointId, businessId }),
    ).toBe(false);

    await SalesInstance.create({
      businessId,
      salesPointId,
      dailyReferenceNumber: 1,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedByUserId: userId,
      openedAsRole: "employee",
    });

    expect(
      await pointBusyForCustomerSelfOrder({ salesPointId, businessId }),
    ).toBe(true);
  });

  it("pointBusyForCustomerSelfOrder allows concurrent customer instances when no employee instance", async () => {
    await SalesInstance.create({
      businessId,
      salesPointId,
      dailyReferenceNumber: 1,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedByUserId: userId,
      openedAsRole: "customer",
    });
    await SalesInstance.create({
      businessId,
      salesPointId,
      dailyReferenceNumber: 1,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedByUserId: userId,
      openedAsRole: "customer",
    });

    expect(
      await pointBusyForCustomerSelfOrder({ salesPointId, businessId }),
    ).toBe(false);
  });
});
