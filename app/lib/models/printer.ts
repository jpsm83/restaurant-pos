import { Schema, model, models } from "mongoose";
import { mainCategories, printerStatus } from "../enums";

const configurationSetupToPrintOrdersSchema = new Schema({
  mainCategory: {
    type: String,
    enum: mainCategories,
    required: true,
  }, // this will dictate what the printer will print as main category
  subCategories: {
    type: [String],
  }, // this will dictate what the printer will print as sub category from the main category
  salesPointIds: {
    type: [Schema.Types.ObjectId],
    ref: "SalesPoint",
    required: true,
  }, // which sales point will use this print with this configuration
  excludeEmployeeIds: { type: [Schema.Types.ObjectId], ref: "Employee" }, // which employees are not allowed to print from this printer
});

const printerSchema = new Schema(
  {
    // required fields
    printerAlias: { type: String, required: true }, // name of the printer "Desert Printer"
    description: { type: String }, // description of the printer
    printerStatus: {
      type: String,
      enum: printerStatus,
      default: "Offline",
    }, // enhanced printer status
    ipAddress: { type: String, required: true, unique: true }, // IP address of the printer
    port: { type: Number, required: true }, // port of the printer
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business that owns the printer
    backupPrinterId: { type: Schema.Types.ObjectId, ref: "Printer" }, // printer reference to print if this printer has an error
    employeesAllowedToPrintDataIds: {
      type: [Schema.Types.ObjectId],
      ref: "Employee",
    }, // which employees can print data - employees are allowed to print from one printer only - ex: bills, sales reports, etc
    configurationSetupToPrintOrders: [configurationSetupToPrintOrdersSchema], // array of objects that will dictate what the printer will print and from wich sales point, it can be multiple variations of prints, thats why it is an array
  },
  { timestamps: true }
);

const Printer = models.Printer || model("Printer", printerSchema);
export default Printer;
