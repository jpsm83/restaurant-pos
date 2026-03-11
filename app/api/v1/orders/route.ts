import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { ordersArrValidation } from "./utils/validateOrdersArr";
import { createOrders } from "./utils/createOrders";
import { applyPromotionsToOrders } from "@/lib/promotions/applyPromotions";
import { checkLowStockAndNotify } from "@/app/api/v1/inventories/utils/checkLowStockAndNotify";

// imported interfaces
import { IOrder } from "@/lib/interface/IOrder";

// imported models
import Order from "@/lib/db/models/order";
import SalesInstance from "@/lib/db/models/salesInstance";
import Employee from "@/lib/db/models/employee";
import BusinessGood from "@/lib/db/models/businessGood";
import SalesPoint from "@/lib/db/models/salesPoint";
import Customer from "@/app/lib/models/customer";

// @desc    Get all orders
// @route   GET /orders
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const orders = await Order.find()
      .populate({
        path: "salesInstanceId",
        select: "salesPointId",
        populate: {
          path: "salesPointId",
          select: "salesPointName",
          model: SalesPoint,
        },
        model: SalesInstance,
      })
      .populate({
        path: "employeeId",
        select: "employeeName allEmployeeRoles currentShiftRole",
        model: Employee,
      })
      .populate({
        path: "customerId",
        select: "employeeName allEmployeeRoles currentShiftRole",
        model: Customer,
      })
      .populate({
        path: "businessGoodId",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .populate({
        path: "addOns",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .lean();

    return !orders.length
      ? new NextResponse(JSON.stringify({ message: "No orders found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(orders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Get all orders failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

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

// @desc    Create new order
// @route   POST /orders
// @access  Private
export const POST = async (req: Request) => {
  // *********** IMPORTANT ***********
  // this route is used only by the employee to create orders
  // the customer will create the order through the salesInstance route
  // *********************************

  // - FLOW - in case if customer pays at the time of the order
  // - CREATE the order with billing status "Open"
  // - GET the order by its ID
  // - UPDATE the order with the payment method and billing status "Paid"
  // - UPDATE the salesInstanceId status to "Closed" (if all orders are paid)
  // - *** IMPORTANT ***
  // - Because it has been payed, doesn't mean orderStatus is "Done"

  // *** ordersArr is an array of objects with the order details ***
  // [
  //    {
  //       orderGrossPrice,
  //       orderNetPrice, - calculated on the front_end following the promotion rules
  //       orderCostPrice,
  //       businessGoodId, addOns - main product + optional add-ons (e.g. burger + extra cheese)
  //       allergens,
  //       promotionApplyed, - automatically set by the front_end upon creation
  //       comments
  //       discountPercentage
  //    }
  //]

  // paymentMethod cannot be created here, only updated - MAKE IT SIMPLE
  const {
    ordersArr,
    employeeId,
    salesInstanceId,
    businessId,
    dailyReferenceNumber,
  } = (await req.json()) as {
    ordersArr: Partial<IOrder>[];
    employeeId: Types.ObjectId;
    salesInstanceId: Types.ObjectId;
    businessId: Types.ObjectId;
    dailyReferenceNumber: string;
  };

  // check required fields
  if (
    !ordersArr ||
    !salesInstanceId ||
    !businessId ||
    !employeeId ||
    !dailyReferenceNumber
  ) {
    return new NextResponse(
      JSON.stringify({
        message:
          "OrdersArr, dailyReferenceNumber, employeeId, salesInstanceId and businessId are required fields!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const objectIds: Types.ObjectId[] = ordersArr.flatMap((order) => [
    order.businessGoodId!,
    ...(order.addOns ?? []),
  ]);
  objectIds.push(businessId, salesInstanceId, employeeId);

  // validate ids
  if (isObjectIdValid(objectIds) !== true) {
    return new NextResponse(
      JSON.stringify({
        message:
          "businessGoodId, addOns, employeeId, businessId or salesInstanceId not valid!",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // validate ordersArr
  const ordersArrValidationResult = ordersArrValidation(ordersArr);
  if (ordersArrValidationResult !== true) {
    return new NextResponse(
      JSON.stringify({ message: ordersArrValidationResult }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // connect before first call to DB
  await connectDb();

  // create a session to handle transactions of the createOrders function
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate client pricing against backend calculation; save only when they match
    const pricedOrders = await applyPromotionsToOrders({
      businessId,
      ordersArr,
    });

    if (typeof pricedOrders === "string") {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: pricedOrders }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const PRICE_TOLERANCE = 0.01;
    for (let i = 0; i < pricedOrders.length; i++) {
      const backend = pricedOrders[i];
      const client = ordersArr[i];
      if (
        Math.abs((client.orderNetPrice ?? 0) - (backend.orderNetPrice ?? 0)) >
          PRICE_TOLERANCE ||
        (client.promotionApplyed !== undefined &&
          backend.promotionApplyed !== undefined &&
          client.promotionApplyed !== backend.promotionApplyed) ||
        (client.promotionApplyed === undefined &&
          backend.promotionApplyed !== undefined) ||
        (client.promotionApplyed !== undefined &&
          backend.promotionApplyed === undefined) ||
        Math.abs(
          (client.discountPercentage ?? 0) - (backend.discountPercentage ?? 0)
        ) > PRICE_TOLERANCE
      ) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message:
              "Order price or promotion does not match server calculation",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const createdOrders = await createOrders(
      dailyReferenceNumber,
      ordersArr,
      employeeId,
      undefined,
      salesInstanceId,
      businessId,
      session
    );

    if (typeof createdOrders === "string") {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: createdOrders }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await session.commitTransaction();

    checkLowStockAndNotify(businessId).catch(() => {});

    return new NextResponse(JSON.stringify({ message: "Order created" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Create order failed!",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    session.endSession();
  }
};
