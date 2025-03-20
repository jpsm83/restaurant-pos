import { Schema, model, models } from "mongoose";
import { allergens, billingStatus, orderStatus } from "../enums.js";
import { paymentMethod } from "./paymentMethod.js";

const orderSchema = new Schema(
  {
    // required fields
    dailyReferenceNumber: {
      type: Number,
      required: [true, "Daily reference number is required!"],
    }, // reference number for the day, every object create in the same day will have the same reference number
    billingStatus: {
      type: String,
      enum: billingStatus,
      default: "Open",
    }, // general status regarding the payment of the order - only VOID, CANCEL and INVITATION can be manually changed by employee
    orderStatus: {
      type: String,
      enum: orderStatus,
      default: "Sent",
    }, // status regarding the order action to be taken or already taken
    orderGrossPrice: {
      type: Number,
      required: [true, "Order gross price is required!"],
    }, // final price of the sun of product being sold regardless of any discounts, voids, or cancellations
    orderNetPrice: {
      type: Number,
      required: [true, "Order net price is required!"],
    }, // amount after adjustments have been made to the final price, voids, invitations, discounts and promotions
    orderCostPrice: {
      type: Number,
      required: [true, "Order cost price is required!"],
    }, // cost price of the sun of product being sold regardless of any discounts, voids, or cancellations
    // one of the following two fields is required - employeeId or customerId
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // employee that made the order
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // employee that made the order
    salesInstanceId: {
      type: Schema.Types.ObjectId,
      ref: "SalesInstance",
      required: [true, "Sales instance id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // salesInstance refers to salesPoint, where the order was made
    businessGoodsIds: {
      type: [Schema.Types.ObjectId],
      ref: "BusinessGood",
      required: [true, "Business good ids is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // can be an aray of business goods (3) "burger with extra cheese and add bacon"
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business where the order was made

    // non required fields
    orderTips: { type: Number }, // tips given or amount left by the client
    paymentMethod: {
      type: [paymentMethod],
      default: undefined,
    },
    allergens: { type: [String], enum: allergens, default: undefined }, // this property is manualy added by the employee, the pos will filter all the business goods allergens that applyed and dont offer them to be purchased, this value will go to the kitcken
    promotionApplyed: { type: String }, // check if promotion is applyed by promotion date and time - done on the front end
    discountPercentage: { type: Number }, // percentage discount applyed manually to the order - cannot apply discount if promotion is applyed
    comments: { type: String }, // if discount, void or cancel are applyed, the reason for it or if or if kitchen needs to know something
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Order = models.Order || model("Order", orderSchema);
export default Order;
