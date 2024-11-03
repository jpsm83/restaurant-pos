import { Schema, model, models } from "mongoose";
import { salesInstanceStatus } from "../enums.js";

const salesInstanceSchema = new Schema(
  {
    // required fields
    dailyReferenceNumber: { type: Number, required: true }, // reference number for the day, every object create in the same day will have the same reference number
    salesPointId: {
      type: Schema.Types.ObjectId,
      ref: "SalesPoint",
      required: true,
    }, // reference with the business sales instance
    guests: { type: Number, required: true }, // number of guests in the table - REQUIRED FOR ANALYTICS
    salesInstanceStatus: {
      type: String,
      enum: salesInstanceStatus,
      default: "Occupied",
    }, // status of the table
    openedByCustomerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    }, // if self ordering, the customer that opened the table
    openedByEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    }, // employee that opened the table
    responsibleById: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    }, // employee that is responsible for the table - one employee can open, finish the shift then pass the responsability to another employee - does not apply for self ordering
    closedById: { type: Schema.Types.ObjectId, ref: "Employee" }, // employee that closed the table, same as responsibleBy - does not apply for self ordering
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the table is located

    // non required fields
    clientName: { type: String }, // name of the client that is in the table
    salesGroup: {
      type: [
        {
          orderCode: { type: String, required: true }, // unique code for the group of orders
          ordersIds: {
            type: [Schema.Types.ObjectId],
            ref: "Order",
            default: undefined,
          }, // array of orders made in the table
          createdAt: { type: Date }, // date and time when the order was made, will be used to count down the time for the kitchen to prepare the order
        },
      ],
      default: undefined,
    }, // orders separate by groups of time ordered made in the salesInstance
    closedAt: { type: Date }, // date and time when the table was closed
  },
  { timestamps: true }
);

const SalesInstance =
  models.SalesInstance || model("SalesInstance", salesInstanceSchema);
export default SalesInstance;
