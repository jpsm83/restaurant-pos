import mongoose, { Schema, model } from "mongoose";

const inventoryCountSchema = new Schema(
  {
    countedDate: { type: Date, default: Date.now },
    currentCountQuantity: { type: Number, required: [true, "Current count quantity is required!"] },
    quantityNeeded: { type: Number, default: 0 },
    countedByEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Counted by employee is required!"],
      index: true,
    },
    deviationPercent: { type: Number, default: 0 },
    lastCount: { type: Boolean, default: true },
    comments: { type: String },
    reedited: {
      reeditedByEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee", index: true },
      date: { type: Date },
      reason: { type: String, required: [true, "Reedited reason is required!"] },
      originalValues: {
        currentCountQuantity: {
          type: Number,
          required: [true, "Original current count quantity is required!"],
        },
        deviationPercent: {
          type: Number,
          required: [true, "Original deviation percent is required!"],
        },
        dynamicSystemCount: {
          type: Number,
          required: [true, "Original dynamic system count is required!"],
        },
      },
    },
  },
  { timestamps: true, trim: true }
);

const inventoryGoodsSchema = new Schema(
  {
    supplierGoodId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierGood",
      required: [true, "Supplier good id is required!"],
      index: true,
    },
    monthlyCounts: { type: [inventoryCountSchema], default: undefined },
    averageDeviationPercent: { type: Number, default: 0 },
    dynamicSystemCount: { type: Number, default: 0 },
  },
  { timestamps: true, trim: true }
);

const inventorySchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    setFinalCount: { type: Boolean, required: [true, "Set final count is required!"], default: false },
    inventoryGoods: { type: [inventoryGoodsSchema], default: undefined },
  },
  { timestamps: true, trim: true }
);

const Inventory = model("Inventory", inventorySchema);
export default Inventory;

