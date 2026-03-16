import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

// import utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { createDailySalesReport } from "@/app/api/v1/dailySalesReports/utils/createDailySalesReport";
import { createSalesInstance } from "../../utils/createSalesInstance";
import { ordersArrValidation } from "@/app/api/v1/orders/utils/validateOrdersArr";
import { createOrders } from "@/app/api/v1/orders/utils/createOrders";
import { closeOrders } from "@/app/api/v1/orders/utils/closeOrders";
import { checkLowStockAndNotify } from "@/app/api/v1/inventories/utils/checkLowStockAndNotify";
import { sendOrderConfirmation } from "@/lib/orderConfirmation/sendOrderConfirmation";

// import interfaces
import {
  IDailySalesReport,
  IGoodsReduced,
} from "@/lib/interface/IDailySalesReport";
import { IBusiness } from "@/lib/interface/IBusiness";
import { ISalesInstance } from "@/lib/interface/ISalesInstance";
import { IOrder } from "@/lib/interface/IOrder";
import { IPaymentMethod } from "@/lib/interface/IPaymentMethod";

// imported models
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import SalesInstance from "@/lib/db/models/salesInstance";
import SalesPoint from "@/lib/db/models/salesPoint";
import Business from "@/lib/db/models/business";
import { isBusinessOpenNow } from "@/lib/utils/isBusinessOpenNow";
import User from "@/lib/db/models/user";
import { validatePaymentMethodArray } from "@/app/api/v1/orders/utils/validatePaymentMethodArray";
import { applyPromotionsToOrders } from "@/lib/promotions/applyPromotions";

// first create a empty salesInstance, then update it with the salesGroup.ordersIds
// @desc    Create new salesInstances
// @route   POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId
// @access  Private
//
// Payment before order submit: under construction; integration with third-party payment provider under study.

// self ordering will do all the flow at once
// create the table
// create the order
// create the payment
// update the dailySalesReport

export const POST = async (
  req: Request,
  context: { params: { selfOrderingLocationId: Types.ObjectId } }
) => {
  const selfOrderingLocationId = context.params.selfOrderingLocationId;

  // 1. customer will scan the QR code
  // 2. if your has an accout it will be redirected to the selfOrdering page
  // 3. if not, the customer will be redirected to the register page (with google or facebook)
  // 4. he will be redirect to the selfOrdering page
  // 5. the customer will select what he wants to eat and drink
  // 6. the customer will pay for the order
  // 7. the customer will receive a confirmation message with the order number
  // 8. the order will be done and delivered to the customer in the salesPoint location

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

  const token = await getToken({
    req: req as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.id || token.type !== "user") {
    return new NextResponse(
      JSON.stringify({ message: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const userId = new Types.ObjectId(token.id as string);

  const { businessId, ordersArr, paymentMethodArr } =
    (await req.json()) as Partial<ISalesInstance> & {
      ordersArr: IOrder[];
      paymentMethodArr: IPaymentMethod[];
    };

  if (
    !selfOrderingLocationId ||
    !businessId ||
    !ordersArr ||
    !paymentMethodArr
  ) {
    return new NextResponse(
      JSON.stringify({
        message:
          "SelfOrderingLocationId, ordersArr, paymentMethodArr and businessId are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const objectIds = [
    ...ordersArr.flatMap((order) => [
      order.businessGoodId!,
      ...(order.addOns ?? []),
    ]),
    businessId,
    selfOrderingLocationId,
  ];

  if (isObjectIdValid(objectIds) !== true) {
    return new NextResponse(
      JSON.stringify({
        message:
          "BusinessId, selfOrderingLocationId or ordersArr's IDs not valid!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
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

  // Validate payment methods
  const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
  if (validPaymentMethods !== true) {
    return new NextResponse(JSON.stringify({ message: validPaymentMethods }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // connect before first call to DB
  await connectDb();

  // Self-ordering is only allowed when the sales point has selfOrdering enabled
  const salesPoint = (await SalesPoint.findById(selfOrderingLocationId)
    .select("selfOrdering businessId")
    .lean()) as {
    selfOrdering: boolean;
    businessId: Types.ObjectId | { _id: Types.ObjectId };
  } | null;
  if (!salesPoint || salesPoint.selfOrdering !== true) {
    return new NextResponse(
      JSON.stringify({
        message: "Self-ordering is not available at this table.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const salesPointBusinessId =
    typeof salesPoint.businessId === "object" &&
    salesPoint.businessId !== null &&
    "_id" in salesPoint.businessId
      ? (salesPoint.businessId as { _id: Types.ObjectId })._id
      : (salesPoint.businessId as Types.ObjectId);
  if (salesPointBusinessId.toString() !== businessId.toString()) {
    return new NextResponse(
      JSON.stringify({ message: "Sales point does not belong to this business." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Enforce business opening hours for customer self-ordering
  const business = (await Business.findById(businessId).lean()) as unknown as IBusiness | null;
  if (!business) {
    return new NextResponse(
      JSON.stringify({ message: "Business not found." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!isBusinessOpenNow(business)) {
    return new NextResponse(
      JSON.stringify({
        message: "Business is currently closed for service.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Block customer self-order when table already has an open session (e.g. opened by staff)
  const dailySalesReportForCheck = (await DailySalesReport.findOne({
    isDailyReportOpen: true,
    businessId,
  })
    .select("dailyReferenceNumber")
    .lean()) as { dailyReferenceNumber: number } | null;
  if (dailySalesReportForCheck) {
    const existingOpenInstance = await SalesInstance.exists({
      dailyReferenceNumber: dailySalesReportForCheck.dailyReferenceNumber,
      businessId,
      salesPointId: selfOrderingLocationId,
      salesInstanceStatus: { $ne: "Closed" },
    });
    if (existingOpenInstance) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Table is being served by staff. Self-ordering is not available until the table is closed.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [user, dailySalesReport] = await Promise.all([
      User.findById(userId)
        .select("personalDetails.firstName personalDetails.lastName")
        .lean(),

      DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean() as unknown as Promise<IDailySalesReport>,
    ]);

    if (!user) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "User not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const userObj = user as { personalDetails?: { firstName?: string; lastName?: string }; username?: string } | null;
    const clientName =
      userObj?.personalDetails?.firstName && userObj?.personalDetails?.lastName
        ? `${userObj.personalDetails.firstName} ${userObj.personalDetails.lastName}`
        : userObj?.username ?? undefined;

    // **** IMPORTANT ****
    // dailySalesReport is created when the first salesInstance of the day is created
    const dailyReferenceNumber = dailySalesReport
      ? dailySalesReport.dailyReferenceNumber
      : await createDailySalesReport(businessId, session);

    if (typeof dailyReferenceNumber === "string") {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: dailyReferenceNumber }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const newSalesInstanceObj = {
      dailyReferenceNumber,
      salesPointId: selfOrderingLocationId,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedByUserId: userId,
      openedAsRole: "customer" as const,
      businessId,
      clientName,
    };

    // create a salesInstance
    // we use a outside function to create the salesInstance because this function is used in other places
    const salesInstance = await createSalesInstance(newSalesInstanceObj, session) as ISalesInstance | string;

    if (typeof salesInstance === "string") {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: salesInstance }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

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
      userId,
      "customer",
      salesInstance._id as Types.ObjectId,
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

    let createdOrdersIds: Types.ObjectId[] = [];
    if (Array.isArray(createdOrders)) {
      createdOrdersIds = createdOrders.map(
        (order: { _id: Types.ObjectId }) => order._id
      );
    } else {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: createdOrders }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // pay the order
    // function closeOrders will automaticaly close the salesInstance once all OPEN orders are closed
    const closeOrdersResult = await closeOrders(
      createdOrdersIds,
      paymentMethodArr,
      session
    );

    if (closeOrdersResult !== true) {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: closeOrdersResult }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const soldGoods: IGoodsReduced[] = [];
    const goodIdsPerOrder = ordersArr.flatMap((order) => [
      order.businessGoodId!,
      ...(order.addOns ?? []),
    ]);
    goodIdsPerOrder.forEach((goodId) => {
      const existingGood = soldGoods.find(
        (good) =>
          (good.businessGoodId?.toString?.() ?? good.businessGoodId) ===
          (goodId?.toString?.() ?? goodId)
      );

      if (existingGood) {
        existingGood.quantity += 1;
      } else {
        soldGoods.push({
          businessGoodId: goodId,
          quantity: 1,
        });
      }
    });

    const totalSalesBeforeAdjustments = createdOrders.reduce(
      (acc: number, order: { orderGrossPrice?: number }) =>
        acc + (order.orderGrossPrice ?? 0),
      0
    );

    const totalNetPaidAmount = createdOrders.reduce(
      (acc: number, order: { orderNetPrice: number }) =>
        acc + order.orderNetPrice,
      0
    );

    const totalCostOfGoodsSold = createdOrders.reduce(
      (acc: number, order: { orderCostPrice: number }) =>
        acc + order.orderCostPrice,
      0
    );

    const dailySalesReportUpdate = await DailySalesReport.updateOne(
      { dailyReferenceNumber },
      {
        $push: {
          selfOrderingSalesReport: {
            userId,
            customerPaymentMethod: paymentMethodArr,
            totalSalesBeforeAdjustments,
            totalNetPaidAmount,
            totalCostOfGoodsSold,
            soldGoods,
          },
        },
      },
      { session }
    );

    if (dailySalesReportUpdate.modifiedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Update dailySalesReport failed!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    checkLowStockAndNotify(businessId).catch(() => {});
    sendOrderConfirmation(userId, businessId, {
      dailyReferenceNumber,
      totalNetPaidAmount,
      orderCount: createdOrders.length,
    }).catch(() => {});

    return new NextResponse(
      JSON.stringify({ message: "Customer self ordering created" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Create salesInstance failed!",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    session.endSession();
  }
};
