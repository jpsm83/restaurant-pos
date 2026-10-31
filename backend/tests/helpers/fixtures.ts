/**
 * Test data fixtures and factories
 * Uses @faker-js/faker for generating realistic test data
 */

import { faker } from "@faker-js/faker";
import { Types } from "mongoose";
import Business from "../../src/models/business.ts";
import Company from "../../src/models/company.ts";
import Employee from "../../src/models/employee.ts";
import Owner from "../../src/models/owner.ts";
import Schedule from "../../src/models/schedule.ts";
import User from "../../src/models/user.ts";

/**
 * Generate a valid MongoDB ObjectId
 */
export function objectId(): string {
  return new Types.ObjectId().toString();
}

/**
 * Generate fake address data
 */
export function fakeAddress() {
  return {
    country: faker.location.country(),
    state: faker.location.state(),
    city: faker.location.city(),
    street: faker.location.street(),
    buildingNumber: faker.location.buildingNumber(),
    doorNumber: String(faker.number.int({ min: 1, max: 99 })),
    complement: `Apt ${faker.number.int({ min: 1, max: 50 })}`,
    postCode: faker.location.zipCode(),
  };
}

/**
 * Generate fake personal details
 */
export function fakePersonalDetails(overrides: Partial<{
  email: string;
  firstName: string;
  lastName: string;
}> = {}) {
  return {
    email: overrides.email ?? faker.internet.email(),
    firstName: overrides.firstName ?? faker.person.firstName(),
    lastName: overrides.lastName ?? faker.person.lastName(),
    phoneNumber: faker.phone.number(),
  };
}

/**
 * Generate fake business data
 */
export function fakeBusiness(overrides: Partial<{
  email: string;
  businessTradeName: string;
}> = {}) {
  return {
    email: overrides.email ?? faker.internet.email(),
    tradeName: overrides.businessTradeName ?? faker.company.name(),
    address: fakeAddress(),
  };
}

/**
 * Generate fake Owner data for a User's portfolio.
 */
export function fakeOwner(
  userId: string,
  overrides: Partial<{ country: string; subscription: string }> = {},
) {
  return {
    userId,
    country: overrides.country ?? faker.location.country(),
    subscription: overrides.subscription ?? "Free",
  };
}

/**
 * Generate fake Company data owned by an Owner.
 */
export function fakeCompany(
  ownerId: string,
  overrides: Partial<{
    country: string;
    legalName: string;
    taxNumber: string;
  }> = {},
) {
  return {
    ownerId,
    country: overrides.country ?? faker.location.country(),
    legalName: overrides.legalName ?? faker.company.name(),
    taxNumber: overrides.taxNumber ?? `TAX-${faker.string.alphanumeric(10)}`,
  };
}

/**
 * Generate a complete Business record, optionally linked to a Company.
 */
export function fakeBusinessRecord(
  overrides: Partial<{ country: string; companyId: string }> = {},
) {
  return {
    tradeName: faker.company.name(),
    legalName: faker.company.name(),
    email: faker.internet.email(),
    phoneNumber: faker.phone.number(),
    taxNumber: `TAX-${faker.string.alphanumeric(10)}`,
    currencyTrade: "EUR",
    subscription: "Free",
    address: {
      ...fakeAddress(),
      country: overrides.country ?? faker.location.country(),
    },
    companyId: overrides.companyId,
  };
}

type TestBusinessOverrides = Record<string, unknown> & {
  companyId?: string | Types.ObjectId;
  country?: string;
};

function businessCountry(overrides: TestBusinessOverrides): string {
  if (typeof overrides.country === "string") {
    return overrides.country;
  }
  const address = overrides.address;
  if (
    address !== null &&
    typeof address === "object" &&
    "country" in address &&
    typeof address.country === "string"
  ) {
    return address.country;
  }
  return "USA";
}

/**
 * Persist a User, Owner, and Company for tests that exercise ownership.
 */
export async function createTestOwnerCompany(
  overrides: Partial<{ country: string }> = {},
) {
  const country = overrides.country ?? "USA";
  const unique = new Types.ObjectId().toString();
  const user = await User.create({
    personalDetails: {
      email: `owner-${unique}@test.com`,
      username: `owner-${unique}`,
      firstName: "Test",
      lastName: "Owner",
    },
  });
  const owner = await Owner.create({ userId: user._id, country });
  const company = await Company.create({ ownerId: owner._id, country });
  return { user, owner, company };
}

/**
 * Persist a Business with an owning Company reference. Pass `companyId` to
 * link an existing Company; otherwise a Company (with its Owner and User) is
 * created for the venue. The caller supplies the Business fields.
 */
export async function createTestBusiness(
  overrides: TestBusinessOverrides = {},
) {
  const country = businessCountry(overrides);
  const {
    country: _country,
    companyId: requestedCompanyId,
    ...rest
  } = overrides;
  const companyId =
    requestedCompanyId ??
    (await createTestOwnerCompany({ country })).company._id;

  return Business.create({
    ...rest,
    companyId,
  });
}

/**
 * Persist an Employee membership. Defaults to an active, non-terminated waiter
 * so access and mode tests can override only the fact under test.
 */
export async function createTestEmployeeMembership(params: {
  businessId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  roles?: string[];
  active?: boolean;
  onDuty?: boolean;
  terminatedDate?: Date;
  deleted?: boolean;
}) {
  return Employee.create({
    businessId: params.businessId,
    userId: params.userId,
    allEmployeeRoles: params.roles ?? ["Waiter"],
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    vacationDaysPerYear: 20,
    active: params.active ?? true,
    onDuty: params.onDuty ?? false,
    terminatedDate: params.terminatedDate,
    deleted: params.deleted ?? false,
  });
}

/** One planned-shift entry for a daily Schedule. */
export function fakeScheduleEntry(params: {
  employeeId: Types.ObjectId | string;
  start: Date;
  end?: Date;
  role?: string;
  vacation?: boolean;
}) {
  return {
    employeeId: params.employeeId,
    role: params.role ?? "Waiter",
    timeRange: {
      startTime: params.start,
      endTime:
        params.end ?? new Date(params.start.getTime() + 60 * 60 * 1000),
    },
    vacation: params.vacation ?? false,
    shiftHours: 1,
    employeeCost: 20,
  };
}

/** Persist one daily Schedule from planned-shift entries. */
export async function createTestSchedule(params: {
  businessId: Types.ObjectId | string;
  date?: Date;
  entries: ReturnType<typeof fakeScheduleEntry>[];
}) {
  return Schedule.create({
    businessId: params.businessId,
    date: params.date ?? new Date(),
    weekNumber: 1,
    employeesSchedules: params.entries,
  });
}

/**
 * Generate fake supplier data
 */
export function fakeSupplier(businessId: string) {
  return {
    businessId,
    tradeName: faker.company.name(),
    contactPerson: faker.person.fullName(),
    email: faker.internet.email(),
    phoneNumber: faker.phone.number(),
    address: fakeAddress(),
  };
}

/**
 * Generate fake supplier good data
 */
export function fakeSupplierGood(supplierId: string, businessId: string) {
  return {
    supplierId,
    businessId,
    name: faker.commerce.productName(),
    mainCategory: faker.commerce.department(),
    subCategory: faker.commerce.productAdjective(),
    measurementUnit: "kg",
    parLevel: faker.number.int({ min: 10, max: 100 }),
    pricePerMeasurementUnit: faker.number.float({ min: 1, max: 50, fractionDigits: 2 }),
    budgetImpact: faker.helpers.arrayElement(["low", "medium", "high"]),
  };
}

/**
 * Generate fake business good (menu item) data
 */
export function fakeBusinessGood(businessId: string) {
  return {
    businessId,
    name: faker.commerce.productName(),
    mainCategory: faker.helpers.arrayElement(["Food", "Beverage", "Dessert"]),
    subCategory: faker.commerce.productAdjective(),
    sellingPrice: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
    costPrice: faker.number.float({ min: 2, max: 20, fractionDigits: 2 }),
    onMenu: true,
  };
}

/**
 * Generate fake sales point data
 */
export function fakeSalesPoint(businessId: string) {
  return {
    businessId,
    salesPointName: `Table ${faker.number.int({ min: 1, max: 50 })}`,
    salesPointType: faker.helpers.arrayElement(["Table", "Bar", "Takeaway"]),
  };
}

/**
 * Generate fake employee data
 */
export function fakeEmployee(businessId: string, userId: string) {
  return {
    businessId,
    userId,
    currentShiftRole: faker.helpers.arrayElement(["Waiter", "Bartender", "Chef", "Manager"]),
    grossHourlySalary: faker.number.float({ min: 10, max: 30, fractionDigits: 2 }),
    netMonthlySalary: faker.number.float({ min: 1500, max: 4000, fractionDigits: 2 }),
  };
}

/**
 * Generate fake order data
 */
export function fakeOrder(businessGoodId: string, salesInstanceId: string, businessId: string) {
  return {
    businessGoodId,
    salesInstanceId,
    businessId,
    billingStatus: "Open",
    orderStatus: "Placed",
    quantity: faker.number.int({ min: 1, max: 5 }),
    sellingPrice: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
  };
}

/**
 * Generate fake reservation data
 */
export function fakeReservation(businessId: string, createdByUserId: string) {
  const reservationStart = faker.date.future();
  const reservationEnd = new Date(reservationStart.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
  
  return {
    businessId,
    createdByUserId,
    guestCount: faker.number.int({ min: 1, max: 10 }),
    reservationStart,
    reservationEnd,
    status: "Pending",
    description: faker.lorem.sentence(),
  };
}

/**
 * Generate fake promotion data
 */
export function fakePromotion(businessId: string) {
  return {
    businessId,
    promotionName: faker.commerce.productAdjective() + " Deal",
    promotionType: "fixedPrice",
    appliesTo: "allItems",
    promotionValue: faker.number.float({ min: 5, max: 20, fractionDigits: 2 }),
    isActive: true,
  };
}
