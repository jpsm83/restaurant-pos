import { Schema, model, models } from "mongoose";
import { mainCategories, measurementUnit, allergens } from "../enums.js";

const businessGoodSchema = new Schema(
  {
    // required fields
    name: { type: String, required: true }, // name of the business good
    keyword: { type: String, required: true }, // keyword for search "burger", "sides", "beer"
    mainCategory: { type: String, enum: mainCategories, required: true }, // principal category of the business good
    subCategory: { type: String, required: true }, // secondary category of the business good
    onMenu: { type: Boolean, required: true, default: true }, // if the business good is on the menu right now
    available: { type: Boolean, required: true, default: true }, // if the business good is available for sale
    sellingPrice: { type: Number, required: true }, // price for customers
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    // BUSINESSGOOD CAN HAVE A INGREDIENTS ARRAY OR SETMENU ARRAY - IT CANNOT BE BOTH
    // ingredients is an array of objects that contains the supplierGood and the quantity needed to build a businessGood
    ingredients: {
      type: [
        {
          supplierGoodId: {
            type: Schema.Types.ObjectId,
            ref: "SupplierGood",
            required: true,
          }, // Supplier good used as an ingredient - e.g., ground meat (id)
          measurementUnit: {
            type: String,
            enum: measurementUnit,
            required: true,
          }, // Unit used for measurement - e.g., (grams) of ground meat - REQUIRED FOR ANALYTICS
          requiredQuantity: { type: Number, required: true }, // Quantity needed to prepare the business good - e.g., (250) grams of ground meat
          costOfRequiredQuantity: { type: Number }, // Cost price of the required quantity to prepare the business good
          // Before the calculation, make sure the ingredient.measurementUnit is the same as the measurementUnit
          // If not, convert the measurementUnit to the ingredient.measurementUnit
          // Then calculate the cost price of the required quantity
          // This calculation is done in the frontend and saved here
        },
      ],
      default: undefined,
    },

    // set menu is a group of business goods that are sold together in a single cheaper price
    setMenuIds: {
      type: [Schema.Types.ObjectId],
      ref: "BusinessGood",
      default: undefined,
    }, // all business goods that are part of the set menu

    // optional fields
    costPrice: { type: Number }, // sun of all ingredients.costOfRequiredQuantity
    grossProfitMarginDesired: { type: Number }, // desired gross profit margin - should show employee a list of most used gross profit margins depending of the dish
    suggestedSellingPrice: { type: Number }, // costPrice / (1 - grossProfitMarginDesired as decimal (65% = 0.65))
    description: { type: String }, // description of the business good
    allergens: { type: [String], enum: allergens, default: undefined }, // allergens of the business good - have to follow the allergens from the supplier goods and add more if needed
    imageUrl: { type: String }, // photo of the business good
    deliveryTime: { type: Number }, // maximun time to deliver the business good to client in minutes
  },
  { timestamps: true }
);

const BusinessGood =
  models.BusinessGood || model("BusinessGood", businessGoodSchema);
export default BusinessGood;
