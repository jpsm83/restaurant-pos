/**
 * Test data fixtures and factories
 * Uses @faker-js/faker for generating realistic test data
 */

import { faker } from "@faker-js/faker";
import { Types } from "mongoose";

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
    password: "TestPassword123!",
    businessTradeName: overrides.businessTradeName ?? faker.company.name(),
    address: fakeAddress(),
  };
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
