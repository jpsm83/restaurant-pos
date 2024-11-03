import mongoose, { ClientSession, Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { updateDynamicCountSupplierGood } from "../../inventories/utils/updateDynamicCountSupplierGood";

// imported interfaces
import { IOrder } from "@/app/lib/interface/IOrder";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// *** IMPORTANT *** PROMOTIONS PRICE SHOULD BE CALCUATED ON THE FRONT END SO PRICE CAN BE SEEN REAL TIME

// INDIVIDUAL BUSINESS GOODS CANNOT HAVE MORE THAN ONE PROMOTION AT THE SAME TIME
// ex: (2x1 COCKTAILS) OR (50% OFF COCKTAILS) CANNOT BE APPLIED AT THE SAME TIME

// AT TIME OF ORDER CREATION IS WHERE WE CHECK IF ANY PROMOTION APPLY FROM THAT TIME ON
// IN THE FRONT CHECK IF THE ORDERS CAN BE APPLIED TO THE CURRENT PROMOTION
// IF IT DOES, APPLY THE CALCULATION AND SAVE THE PROMOTION NAME AND UPDATED NET PRICE
// ALL ORDERS WITH PROMOTION SHOULD HAVE THE PROMOTION NAME (FOR EASY INDENTIFICATION)
// IF PROMOTION APPLY TO THE ORDER, UPDATE ITS PRICE WITH THE PROMOTION RULES

// FOR SECOND ROUND OF ORDERS
// CHECK IF THE PROMOTION STILL APPLY
// GATHER ALL ORDERS THAT APPLY TO THE SAME PROMOTION, ORDERS ALREADY CREATED AND NEW ONES
// THE ABOVE LINE IS ALSO CHECKED ON THE FRONT END
// UPDATE THE PRICE OF THE ORDERS BEEN CREATED FOLLOWING THE PROMOTION RULES

// ===================================
// === FIRST ROUND OF ORDERS =========
// === ORDER_1 PRICE_100 PROMO_2x1 ===
// === ORDER_2   PRICE_0 PROMO_2x1 ===
// === ORDER_3 PRICE_100 PROMO_2x1 ===
// ===================================
// === SECOND ROUND OF ORDERS ========
// === ORDER_4 ccPRICE_0 PROMO_2x1 ===
// ===================================

// ORDERS ARE CREATED INDIVIDUALLY UNLESS IT HAS ADDONS
// THAT WAY WE CAN APPLY PROMOTIONS TO INDIVIDUAL ORDERS, MANAGE PAYMENTS AND TRACK THE STATUS OF EACH ORDER EASILY

export const createOrders = async (
  dailyReferenceNumber: string,
  ordersArr: Partial<IOrder>[],
  employeeId: Types.ObjectId | undefined,
  customerId: Types.ObjectId | undefined,
  salesInstanceId: Types.ObjectId,
  businessId: Types.ObjectId,
  session: ClientSession
) => {
  // connect before first call to DB
  await connectDb();

  try {
    if (employeeId) {
      // Check if salesInstanceId exists and is open and get the dailySalesReport reference number
      const salesInstance: ISalesInstance | null = await SalesInstance.findById(
        salesInstanceId
      )
        .select("status")
        .lean();

      if (!salesInstance || salesInstance.salesInstanceStatus === "Closed") {
        return "SalesInstance not found or closed!";
      }
    }

    // ***********************************************
    // ORDERS CAN BE DUPLICATED WITH DIFFERENT IDs ***
    // ***********************************************

    // orderStatus will always be "Sent" at the time of creation unless employee set it to something else manually at the front end
    // all orders sent will have their own screen where employees can change the status of the order (kitchen, bar, merchandise, etc.)

    // Prepare orders for bulk insertion
    const ordersToInsert = ordersArr.map((order) => ({
      dailyReferenceNumber: dailyReferenceNumber,
      billingStatus: "Open",
      orderStatus: "Sent",
      employeeId: employeeId || undefined,
      customerId: customerId || undefined,
      salesInstanceId,
      businessId,
      orderGrossPrice: order.orderGrossPrice,
      orderNetPrice: order.orderNetPrice,
      orderCostPrice: order.orderCostPrice,
      businessGoodsIds: order.businessGoodsIds,
      allergens: order.allergens || undefined,
      promotionApplyed: order.promotionApplyed || undefined,
      comments: order.comments || undefined,
      discountPercentage: order.discountPercentage || undefined,
    }));

    // Bulk insert the orders
    const ordersCreated = await Order.insertMany(ordersToInsert, { session });

    if (!ordersCreated || ordersCreated.length === 0) {
      return "Orders not created!";
    }

    const ordersIdsCreated = ordersCreated.map((order) => order._id);
    const businessGoodsIds = ordersCreated.flatMap(
      (order) => order.businessGoodsIds
    );

    // update the dynamic count of the supplier goods ingredients
    // dynamicSystemCount have to decrease because the ingredients are being used
    let updateDynamicCountSupplierGoodResult: any =
      await updateDynamicCountSupplierGood(businessGoodsIds, "remove", session);

    if (updateDynamicCountSupplierGoodResult !== true) {
      return (
        "updateDynamicCountSupplierGood failed! Error: " +
        updateDynamicCountSupplierGoodResult
      );
    }

    // set the order code for employee or customer tracking purposes
    // it will be add on the salesInstance.salesGroup array related with this group of orders
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = String(new Date().getDate()).padStart(2, "0");
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const dayOfWeek = weekDays[new Date().getDay()];
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000);

    const orderCode = `${day}${month}${dayOfWeek}${randomNum}`;

    // After order is created, add order ID to salesInstanceId
    const updatedSalesInstance = await SalesInstance.updateOne(
      { _id: salesInstanceId },
      {
        $push: {
          salesGroup: {
            orderCode: orderCode,
            ordersIds: ordersIdsCreated,
            createdAt: new Date(),
          },
        },
      },
      { session }
    );

    if (updatedSalesInstance.modifiedCount === 0) {
      return "SalesInstance not updated!";
    }

    return ordersCreated;
  } catch (error) {
    return handleApiError("Create order failed!", error);
  }
};
