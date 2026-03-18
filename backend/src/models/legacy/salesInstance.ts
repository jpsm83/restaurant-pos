import { Schema, model, models } from "mongoose";
import { salesInstanceStatusEnums } from "@/lib/enums";

const salesInstanceSchema = new Schema(
  {
    // required fields
    dailyReferenceNumber: {
      type: Number,
      required: [true, "Daily reference number is required!"],
    }, // reference number for the day, every object create in the same day will have the same reference number
    salesPointId: {
      type: Schema.Types.ObjectId,
      ref: "SalesPoint",
      required: [true, "Sales point id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // reference with the business sales instance
    guests: { type: Number, required: [true, "Guest is required!"] }, // number of guests in the table - REQUIRED FOR ANALYTICS
    salesInstanceStatus: {
      type: String,
      enum: salesInstanceStatusEnums,
      default: "Occupied",
    }, // status of the table
    openedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // user that opened the table (employee or customer by openedAsRole)
    openedAsRole: {
      type: String,
      enum: ["employee", "customer"],
    }, // whether opened as employee or customer
    responsibleByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // user (employee) that is responsible for the table - one can open, finish the shift then pass the responsability to another - does not apply for self ordering
    closedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    }, // user (employee) that closed the table, same as responsibleBy - does not apply for self ordering
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business where the table is located
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: "Reservation",
      index: true,
    }, // optional link to reservation that originated this sales instance (set on first order)

    // non required fields
    clientName: { type: String }, // name of the client that is in the table
    salesGroup: {
      type: [
        {
          orderCode: {
            type: String,
            required: [true, "Order code is required!"],
          }, // unique code for the group of orders
          ordersIds: {
            type: [Schema.Types.ObjectId],
            ref: "Order",
            default: undefined,
            index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
          }, // array of orders made in the table
          createdAt: { type: Date }, // date and time when the order was made, will be used to count down the time for the kitchen to prepare the order
        },
      ],
      default: undefined,
    }, // orders separate by groups of time ordered made in the salesInstance
    closedAt: { type: Date }, // date and time when the table was closed
  },
  {
    timestamps: true,
    trim: true,
  }
);

const SalesInstance =
  models.SalesInstance || model("SalesInstance", salesInstanceSchema);
export default SalesInstance;
