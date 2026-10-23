/**
 * The paymentId idempotency key is client-settable on exactly two bodies:
 * delivery payment and self-ordering payment. Every other request body rejects it.
 */
import { describe, expect, it } from "vitest";

import {
  confirmEmailBodySchema,
  confirmEmailChangeBodySchema,
  loginBodySchema,
  requestEmailChangeBodySchema,
  requestEmailConfirmationBodySchema,
  requestPasswordResetBodySchema,
  resetPasswordBodySchema,
  setModeBodySchema,
  signupBodySchema,
} from "restaurant-pos-packages/schemas/auth";
import {
  createBusinessBodySchema,
  updateBusinessBodySchema,
} from "restaurant-pos-packages/schemas/business";
import {
  createBusinessGoodBodySchema,
  updateBusinessGoodBodySchema,
} from "restaurant-pos-packages/schemas/businessGood";
import { updateMonthlyBusinessReportBodySchema } from "restaurant-pos-packages/schemas/businessReports";
import { calculateUsersReportBodySchema } from "restaurant-pos-packages/schemas/dailySalesReports";
import {
  createEmployeeBodySchema,
  patchEmployeeBodySchema,
} from "restaurant-pos-packages/schemas/employee";
import { createOrderBodySchema } from "restaurant-pos-packages/schemas/orders";
import {
  createPromotionBodySchema,
  updatePromotionBodySchema,
} from "restaurant-pos-packages/schemas/promotions";
import {
  addPurchaseItemBodySchema,
  createPurchaseBodySchema,
  deletePurchaseItemBodySchema,
  editPurchaseItemBodySchema,
  updatePurchaseBodySchema,
} from "restaurant-pos-packages/schemas/purchase";
import { createRatingBodySchema } from "restaurant-pos-packages/schemas/ratings";
import {
  createReservationBodySchema,
  updateReservationBodySchema,
} from "restaurant-pos-packages/schemas/reservations";
import {
  createDeliveryOrderBodySchema,
  createSalesInstanceBodySchema,
  createSelfOrderBodySchema,
  openSelfOrderingTableBodySchema,
  transferSalesPointBodySchema,
  updateSalesInstanceBodySchema,
} from "restaurant-pos-packages/schemas/salesInstances";
import {
  createSalesPointBodySchema,
  updateSalesPointBodySchema,
} from "restaurant-pos-packages/schemas/salesPoints";
import {
  addEmployeeBodySchema,
  createScheduleBodySchema,
  deleteEmployeeBodySchema,
  updateEmployeeBodySchema,
  updateScheduleBodySchema,
} from "restaurant-pos-packages/schemas/schedules";
import {
  createSupplierBodySchema,
  updateSupplierBodySchema,
} from "restaurant-pos-packages/schemas/supplier";
import {
  createSupplierGoodBodySchema,
  updateSupplierGoodBodySchema,
} from "restaurant-pos-packages/schemas/supplierGood";
import {
  createUserBodySchema,
  markNotificationDeletedBodySchema,
  updateUserBodySchema,
} from "restaurant-pos-packages/schemas/user";
import {
  addInventoryCountBodySchema,
  createInventoryBodySchema,
  updateInventoryCountBodySchema,
} from "../../src/schemas/inventories.ts";
import {
  createNotificationBodySchema,
  updateNotificationBodySchema,
} from "../../src/schemas/notifications.ts";
import {
  configurationSetupBodySchema,
  createPrinterBodySchema,
  updatePrinterBodySchema,
} from "../../src/schemas/printers.ts";

const VALID_ID = "507f1f77bcf86cd799439011";

type BodySchema = {
  shape: Record<string, unknown>;
  safeParse: (data: unknown) => { success: boolean };
};

/** Bodies that must refuse a client paymentId. Add a new body DTO here. */
const bodiesThatRejectPaymentId: Record<string, BodySchema> = {
  signupBodySchema,
  loginBodySchema,
  requestEmailConfirmationBodySchema,
  requestPasswordResetBodySchema,
  requestEmailChangeBodySchema,
  confirmEmailBodySchema,
  confirmEmailChangeBodySchema,
  resetPasswordBodySchema,
  setModeBodySchema,
  createBusinessBodySchema,
  updateBusinessBodySchema,
  createBusinessGoodBodySchema,
  updateBusinessGoodBodySchema,
  updateMonthlyBusinessReportBodySchema,
  calculateUsersReportBodySchema,
  createEmployeeBodySchema,
  patchEmployeeBodySchema,
  createOrderBodySchema,
  createPromotionBodySchema,
  updatePromotionBodySchema,
  createPurchaseBodySchema,
  updatePurchaseBodySchema,
  addPurchaseItemBodySchema,
  deletePurchaseItemBodySchema,
  editPurchaseItemBodySchema,
  createRatingBodySchema,
  createReservationBodySchema,
  updateReservationBodySchema,
  createSalesInstanceBodySchema,
  updateSalesInstanceBodySchema,
  transferSalesPointBodySchema,
  openSelfOrderingTableBodySchema,
  createSalesPointBodySchema,
  updateSalesPointBodySchema,
  createScheduleBodySchema,
  updateScheduleBodySchema,
  addEmployeeBodySchema,
  updateEmployeeBodySchema,
  deleteEmployeeBodySchema,
  createSupplierBodySchema,
  updateSupplierBodySchema,
  createSupplierGoodBodySchema,
  updateSupplierGoodBodySchema,
  createUserBodySchema,
  updateUserBodySchema,
  markNotificationDeletedBodySchema,
  createInventoryBodySchema,
  addInventoryCountBodySchema,
  updateInventoryCountBodySchema,
  createNotificationBodySchema,
  updateNotificationBodySchema,
  createPrinterBodySchema,
  updatePrinterBodySchema,
  configurationSetupBodySchema,
};

const orderLine = {
  businessGoodId: VALID_ID,
  orderGrossPrice: 10,
  orderNetPrice: 10,
  orderCostPrice: 3,
};

const paymentLine = {
  paymentMethodType: "Cash",
  methodBranch: "Cash",
  methodSalesTotal: 10,
};

describe("paymentId exception", () => {
  it("accepts paymentId on the delivery and self-order payment bodies", () => {
    const shared = {
      businessId: VALID_ID,
      ordersArr: [orderLine],
      paymentMethodArr: [paymentLine],
      paymentId: "pay-123",
    };

    expect(createDeliveryOrderBodySchema.safeParse(shared).success).toBe(true);
    expect(createSelfOrderBodySchema.safeParse(shared).success).toBe(true);
  });

  it.each(Object.entries(bodiesThatRejectPaymentId))(
    "%s rejects a client paymentId",
    (name, schema) => {
      expect(Object.keys(schema.shape), name).not.toContain("paymentId");
      expect(schema.safeParse({ paymentId: "pay-1" }).success, name).toBe(
        false,
      );
    },
  );
});
