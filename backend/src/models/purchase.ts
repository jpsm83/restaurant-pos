import { Schema, model } from "mongoose";

const purchaseItemInventorySchema = new Schema(
  {
    supplierGoodId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierGood",
      required: [true, "Supplier good id is required!"],
      index: true,
    },
    quantityPurchased: {
      type: Number,
      required: [true, "Quantity purchased is required!"],
    },
    purchasePrice: {
      type: Number,
      required: [true, "Purchase price is required!"],
    },
    lastEditByEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    lastEditReason: { type: String },
    lastEditDate: { type: Date },
    lastEditOriginalQuantity: { type: Number },
    lastEditOriginalPrice: { type: Number },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const purchaseSchema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "Supplier id is required!"],
      index: true,
    },
    purchaseDate: {
      type: Date,
      required: [true, "Purchase date is required!"],
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    purchasedByEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Purchase by employee id is required!"],
      index: true,
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required!"],
    },
    receiptId: { type: String, required: [true, "Receipt id is required!"] },
    title: { type: String },
    documentsUrl: { type: [String] },
    purchaseInventoryItems: {
      type: [purchaseItemInventorySchema],
      default: undefined,
    },
    oneTimePurchase: { type: Boolean, default: false },
    comment: { type: String },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Purchase = model("Purchase", purchaseSchema);
export default Purchase;
