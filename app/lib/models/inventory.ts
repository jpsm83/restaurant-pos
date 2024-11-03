import { Schema, model, models } from "mongoose";

// Schema for individual count events will be created only upon the count of the inventory
const inventoryCountSchema = new Schema({
  countedDate: { type: Date, required: true, default: Date.now }, // Date when the count was performed

  // ************************* IMPORTANT *************************
  // this quantity is base on the supplierGood.MEAUREMENTUNIT
  currentCountQuantity: { type: Number, required: true }, // quantity of the good in the current real count
  // *************************************************************

  quantityNeeded: { type: Number, default: 0 }, // quantity needed to reach the parLevel. Difference between the parLevel and the currentCountQuantity. parLevel is defined in the supplierGood - all related with the MEASUREMENTUNIT
  countedByEmployeeId: {
    type: Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  }, // Employee who counted, not the employee in session but a employee that is assigned to count the inventory
  deviationPercent: { type: Number, required: true, default: 0 }, // differece between the dynamicSystemCount and the currentCountQuantity in percentage. For a perfect inventory, this number should be 0
  lastCount: { type: Boolean, required: true, default: true }, // if this is the last count of the month, only this one can be updated
  comments: { type: String }, // Comments about the inventory
  // counte cannot be re-edited once is send, if there is a mistake, the employee will have to contact the admin to re-edit and this will be recorded in the reedited field
  reedited: {
    reeditedByEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee" }, // Employee who re-edited - employee in session
    date: { type: Date }, // Date when the re-edit occurred
    reason: { type: String, required: true }, // Reason for the re-edit
    originalValues: {
      currentCountQuantity: { type: Number, required: true },
      deviationPercent: { type: Number, required: true },
      dynamicSystemCount: { type: Number, required: true },
    }, // Original values before re-edit
  },
});

// on the creation of the inventory, one object for each supplierGood will be created
const inventoryGoodsSchema = new Schema({
  supplierGoodId: {
    type: Schema.Types.ObjectId,
    ref: "SupplierGood",
    required: true,
  }, // Good in the inventory
  monthlyCounts: [inventoryCountSchema], // Array of count events objects for the month
  averageDeviationPercent: { type: Number, default: 0 }, // sun of all average deviation percent for the month divide by the number of counts

  // ************************* IMPORTANT *************************
  // this quantity is base on the supplierGood.MEAUREMENTUNIT
  dynamicSystemCount: { type: Number, default: 0 }, // quantity start point of the good. Its equal to inventoryCount.currentCountQuantity. From there, it will be automaticaly updated base on the orders, substracting its supplierGood used to manufactured the businessGoods in the orders or will be add when purchases are done and recived. Upon next inventory count, this field will set the inventory.systemCountQuantity value, then it will be reset to the value of inventoryCount.currentCountQuantity - REQUIRED FOR ANALITCS
});

// Inventory schema to manage the overall inventory event of the month (1 month = 1 inventory)
const inventorySchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // Business that the inventory belongs to
    setFinalCount: { type: Boolean, required: true, default: false }, // Locking mechanism to prevent further counts, is auto set to true on the final of the last day of the month
    // on the first day of the month, the system will create a new inventory with all the supplier goods and setFinalCount to false
    inventoryGoods: {
      type: [inventoryGoodsSchema],
    }, // all the supplier goods that exists on the business
  },
  {
    timestamps: true,
  }
);

// Create the model
const Inventory = models.Inventory || model("Inventory", inventorySchema);
export default Inventory;
