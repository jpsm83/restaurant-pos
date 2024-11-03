import { Schema, model, models } from "mongoose";
import { allergens, billingStatus, orderStatus } from "../enums.js";
import { paymentMethod } from "./paymentMethod";

const orderSchema = new Schema(
  {
    // required fields
    dailyReferenceNumber: { type: Number, required: true }, // reference number for the day, every object create in the same day will have the same reference number
    billingStatus: {
      type: String,
      enum: billingStatus,
      default: "Open",
      required: true,
    }, // general status regarding the payment of the order - only VOID, CANCEL and INVITATION can be manually changed by employee
    orderStatus: {
      type: String,
      enum: orderStatus,
      default: "Sent",
      required: true,
    }, // status regarding the order action to be taken or already taken
    orderGrossPrice: { type: Number, required: true }, // final price of the sun of product being sold regardless of any discounts, voids, or cancellations
    orderNetPrice: { type: Number, required: true }, // amount after adjustments have been made to the final price, voids, invitations, discounts and promotions
    orderCostPrice: { type: Number, required: true }, // cost price of the sun of product being sold regardless of any discounts, voids, or cancellations
    // one of the following two fields is required - employeeId or customerId
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    }, // employee that made the order
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    }, // employee that made the order
    salesInstanceId: {
      type: Schema.Types.ObjectId,
      ref: "SalesInstance",
      required: true,
    }, // salesInstance refers to salesPoint, where the order was made
    businessGoodsIds: {
      type: [Schema.Types.ObjectId],
      ref: "BusinessGood",
      required: true,
    }, // can be an aray of business goods (3) "burger with extra cheese and add bacon"
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
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
  }
);

const Order = models.Order || model("Order", orderSchema);
export default Order;
