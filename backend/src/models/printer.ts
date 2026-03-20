import { Schema, model, models } from "mongoose";
import { mainCategoriesEnums, printerStatusEnums } from "../../../lib/enums.ts";

const configurationSetupToPrintOrdersSchema = new Schema(
  {
    mainCategory: {
      type: String,
      enum: mainCategoriesEnums,
      required: [true, "Main category is required!"],
    }, // this will dictate what the printer will print as main category
    subCategories: {
      type: [String],
      default: undefined,
    }, // this will dictate what the printer will print as sub category from the main category
    salesPointIds: {
      type: [Schema.Types.ObjectId],
      ref: "SalesPoint",
      required: [true, "Sales point id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // which sales point will use this print with this configuration
    excludeEmployeeIds: {
      type: [Schema.Types.ObjectId],
      ref: "Employee",
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // which employees are not allowed to print from this printer
  },
  {
    timestamps: true,
    trim: true,
  }
);

const printerSchema = new Schema(
  {
    // required fields
    printerAlias: {
      type: String,
      required: [true, "Printer alias is required!"],
    }, // name of the printer "Desert Printer"
    description: { type: String }, // description of the printer
    printerStatus: {
      type: String,
      enum: printerStatusEnums,
      default: "Offline",
    }, // enhanced printer status
    ipAddress: {
      type: String,
      required: [true, "Ip address is required!"],
      unique: true,
    }, // IP address of the printer
    port: { type: Number, required: [true, "Port is required!"] }, // port of the printer
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business that owns the printer
    backupPrinterId: { type: Schema.Types.ObjectId, ref: "Printer" }, // printer reference to print if this printer has an error
    employeesAllowedToPrintDataIds: {
      type: [Schema.Types.ObjectId],
      ref: "Employee",
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // which employees can print data - employees are allowed to print from one printer only - ex: bills, sales reports, etc
    configurationSetupToPrintOrders: {
      type: [configurationSetupToPrintOrdersSchema],
      default: undefined,
    }, // array of objects that will dictate what the printer will print and from wich sales point, it can be multiple variations of prints, thats why it is an array
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Printer = models.Printer || model("Printer", printerSchema);
export default Printer;
