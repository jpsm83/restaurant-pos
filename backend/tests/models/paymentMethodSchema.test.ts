/**
 * Regression: the shared `paymentMethod` sub-schema must accept the `Cash`
 * branch, which `validatePaymentMethodArray` requires for a `Cash` payment.
 * Previously `allPaymentMethodsEnums` omitted "Cash", so persisted payments
 * failed Mongoose enum validation at close time.
 */
import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { paymentMethod } from "../../src/models/paymentMethod.ts";

const PaymentMethod =
  mongoose.models.PaymentMethodSchemaTest ||
  mongoose.model("PaymentMethodSchemaTest", paymentMethod);

describe("paymentMethod schema", () => {
  it("accepts a Cash branch for a Cash payment type", async () => {
    const doc = new PaymentMethod({
      paymentMethodType: "Cash",
      methodBranch: "Cash",
      methodSalesTotal: 10,
    });

    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("accepts a known card branch", async () => {
    const doc = new PaymentMethod({
      paymentMethodType: "Card",
      methodBranch: "Visa",
      methodSalesTotal: 10,
    });

    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("rejects an unknown branch", async () => {
    const doc = new PaymentMethod({
      paymentMethodType: "Card",
      methodBranch: "Not A Real Branch",
      methodSalesTotal: 10,
    });

    await expect(doc.validate()).rejects.toThrow();
  });
});
