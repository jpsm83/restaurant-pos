import { Schema, model, models } from "mongoose";
import {
  mainCategories,
  purchaseUnit,
  measurementUnit,
  allergens,
  budgetImpact,
  inventorySchedule,
} from "../enums.js";

const supplierGoodSchema = new Schema(
  {
    // required fields
    name: { type: String, required: true }, // name of the good "King Authur all purpose flour"
    keyword: { type: String, required: true }, // keyword of the good "flour"
    mainCategory: { type: String, enum: mainCategories, required: true }, // principal category of the business good
    subCategory: { type: String, required: true }, // secondary category of the business good
    currentlyInUse: { type: Boolean, required: true, default: true }, // if the good is currently in use base on the business goods
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    }, // supplier of the good - it is required upon creation but it can be updated to undefined if supplier is deleted
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business that deals with the supplier

    // optional fields
    description: { type: String }, // description of the good
    allergens: { type: [String], enum: allergens, default: undefined }, // allergens of the good
    budgetImpact: { type: String, enum: budgetImpact }, // how relevant is the good on the business budget
    imageUrl: {
      type: String,
    }, // photo of the good
    inventorySchedule: { type: String, enum: inventorySchedule }, // daily, weekly, monthly

    // analytics fields
    minimumQuantityRequired: { type: Number }, // limit quantity required for a day work

    // ************************* IMPORTANT *************************
    // parLevel is base on MEASUREMENT UNIT,
    parLevel: { type: Number }, // optimal quantity to maintain, bar orders have to reach this level - if par level is 100, you got 20, today is order day, you have to order 80
    // *************************************************************

    purchaseUnit: {
      type: String,
      enum: purchaseUnit,
    }, // unit in which the good is sold - block of cheese, bag of bread, milk gallon, unit
    measurementUnit: {
      type: String,
      enum: measurementUnit,
    }, // unit used for conversion, measurement on how to good is bought - kilogram, liter, unit
    quantityInMeasurementUnit: { type: Number }, // quantity of the good in measurementUnit - ex: 10kg, 1L, 5 units
    totalPurchasePrice: { type: Number }, // price of purchaseUnit
    pricePerMeasurementUnit: { type: Number }, // totalPurchasePrice / quantityInMeasurementUnit

    // purchaseUnit | measurementUnit | quantityInMeasurementUnit | totalPurchasePrice | pricePerMeasurementUnit
    // =========================================================================================================
    //    Box       |     Kilogram    |          20               |       40€          |    2€ per kilogram
    //   Carton     |      Liter      |          10               |       10€          |    1€ per liter
    //    Unit      |      Unit       |           1               |        3€          |    3€ per unit
    //    Bag       |     Kilogram    |           5               |       15€          |    3€ per kilogram

    // IMPORTANT *** this caluclation will be done automatically in the backend
    // this will need information of orders to do so
    // ONLY FOR FOOD AND BEVERAGE GOODS
    // LOGIC HAVE TO BE CREATE IN THE ORDER CONTROLLER
  },
  {
    timestamps: true,
  }
);

const SupplierGood =
  models.SupplierGood || model("SupplierGood", supplierGoodSchema);
export default SupplierGood;
