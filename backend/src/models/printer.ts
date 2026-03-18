import { Schema, model } from "mongoose";
import { mainCategoriesEnums, printerStatusEnums } from "../enums.js";

const configurationSetupToPrintOrdersSchema = new Schema(
  {
    mainCategory: {
      type: String,
      enum: mainCategoriesEnums,
      required: [true, "Main category is required!"],
    },
    subCategories: {
      type: [String],
      default: undefined,
    },
    salesPointIds: {
      type: [Schema.Types.ObjectId],
      ref: "SalesPoint",
      required: [true, "Sales point id is required!"],
      index: true,
    },
    excludeEmployeeIds: {
      type: [Schema.Types.ObjectId],
      ref: "Employee",
      index: true,
    },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const printerSchema = new Schema(
  {
    printerAlias: {
      type: String,
      required: [true, "Printer alias is required!"],
    },
    description: { type: String },
    printerStatus: {
      type: String,
      enum: printerStatusEnums,
      default: "Offline",
    },
    ipAddress: {
      type: String,
      required: [true, "Ip address is required!"],
      unique: true,
    },
    port: { type: Number, required: [true, "Port is required!"] },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    backupPrinterId: { type: Schema.Types.ObjectId, ref: "Printer" },
    employeesAllowedToPrintDataIds: {
      type: [Schema.Types.ObjectId],
      ref: "Employee",
      index: true,
    },
    configurationSetupToPrintOrders: {
      type: [configurationSetupToPrintOrdersSchema],
      default: undefined,
    },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Printer = model("Printer", printerSchema);
export default Printer;
