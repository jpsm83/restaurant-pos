import { Schema, model, models } from "mongoose";

// on the time of record the purchase, employee should be able to select the supplier good in a dropdown
// and from there employee should be able to see the supplierGood.pricePerMeasurementUnit to compare with the price of the purchase
// if they are not the same, the employee should be able to edit the supplierGood.pricePerMeasurementUnit
const purchaseItemInventorySchema = new Schema(
  {
    supplierGoodId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierGood",
      required: [true, "Supplier good id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // Reference to the specific good

    // ************************* IMPORTANT *************************
    // this quantity is base on the supplierGood.MEAUREMENTUNIT - NOT on the supplierGood.purchaseUnit
    quantityPurchased: {
      type: Number,
      required: [true, "Quantity purchased is required!"],
    }, // Quantity of this good purchased - ex: 10kg, 1L, 5 units
    // *************************************************************

    // ************************* IMPORTANT *************************
    purchasePrice: {
      type: Number,
      required: [true, "Purchase price is required!"],
    }, // this is calculate on the FRONT before be saved on DB supplierGood.pricePerMeasurementUnit * quantityPurchased for employee confirmation
    // ex: 10kg * 2€ = 20€ - if the receipt says 25€, the employee should be able to edit the supplierGood.pricePerMeasurementUnit **** IMPORTANT for the analytics
  },
  {
    timestamps: true,
    trim: true,
  }
);

const purchaseSchema = new Schema(
  {
    title: { type: String }, // Title of the purchase
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "Supplier id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // Supplier from whom the goods are purchased
    imageUrl: { type: String }, // Photo of the receipt
    purchaseDate: {
      type: Date,
      required: [true, "Purchase date is required!"],
    }, // Date of the purchase
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // Business that made the purchase
    purchasedByEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Purchase by employee id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // Employee who made the purchase
    purchaseInventoryItems: {
      type: [purchaseItemInventorySchema],
      default: undefined,
    }, // Array of goods in this purchase
    oneTimePurchase: { type: Boolean, default: false }, // If the purchase is a one time purchase
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required!"],
    }, // Total price of the purchase
    receiptId: { type: String, required: [true, "Receipt id is required!"] }, // supplier receipt identification from supplier - if not available, system will generate one
    comment: { type: String }, // Comment on the purchase
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Purchase = models.Purchase || model("Purchase", purchaseSchema);
export default Purchase;
