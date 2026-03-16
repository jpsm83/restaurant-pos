import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { createDailySalesReport } from "@/app/api/v1/dailySalesReports/utils/createDailySalesReport";
import { createSalesInstance } from "../utils/createSalesInstance";
import { ordersArrValidation } from "@/app/api/v1/orders/utils/validateOrdersArr";
import { createOrders } from "@/app/api/v1/orders/utils/createOrders";
import { closeOrders } from "@/app/api/v1/orders/utils/closeOrders";
import { checkLowStockAndNotify } from "@/app/api/v1/inventories/utils/checkLowStockAndNotify";
import { sendOrderConfirmation } from "@/lib/orderConfirmation/sendOrderConfirmation";
import { isDeliveryOpenNow } from "@/lib/utils/isBusinessOpenNow";

import { IDailySalesReport } from "@/lib/interface/IDailySalesReport";
import { ISalesInstance } from "@/lib/interface/ISalesInstance";
import { IOrder } from "@/lib/interface/IOrder";
import { IPaymentMethod } from "@/lib/interface/IPaymentMethod";
import { IAddress } from "@/lib/interface/IAddress";
import { IBusiness } from "@/lib/interface/IBusiness";

import DailySalesReport from "@/lib/db/models/dailySalesReport";
// SalesInstance model is used indirectly via createSalesInstance
// but does not need to be referenced directly in this file.
import SalesPoint from "@/lib/db/models/salesPoint";
import User from "@/lib/db/models/user";
import Business from "@/lib/db/models/business";
import { validatePaymentMethodArray } from "@/app/api/v1/orders/utils/validatePaymentMethodArray";
import { applyPromotionsToOrders } from "@/lib/promotions/applyPromotions";
import { DELIVERY_ATTRIBUTION_USER_ID } from "@/lib/constants";

type DeliveryRequestBody = {
  businessId: Types.ObjectId;
  ordersArr: IOrder[];
  paymentMethodArr: IPaymentMethod[];
  deliveryAddress?: IAddress;
};

export const POST = async (req: Request) => {
  try {
    const token = await getToken({
      req: req as Parameters<typeof getToken>[0]["req"],
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.id || token.type !== "user") {
      return new NextResponse(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userId = new Types.ObjectId(token.id as string);

    const { businessId, ordersArr, paymentMethodArr, deliveryAddress } =
      (await req.json()) as DeliveryRequestBody;

    if (!businessId || !ordersArr || !paymentMethodArr) {
      return new NextResponse(
        JSON.stringify({
          message:
            "businessId, ordersArr and paymentMethodArr are required for delivery orders!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const objectIds = [
      businessId,
      ...ordersArr.flatMap((order) => [
        order.businessGoodId!,
        ...(order.addOns ?? []),
      ]),
    ];

    if (isObjectIdValid(objectIds) !== true) {
      return new NextResponse(
        JSON.stringify({
          message: "businessId or ordersArr's IDs not valid!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const ordersArrValidationResult = ordersArrValidation(ordersArr);
    if (ordersArrValidationResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: ordersArrValidationResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
    if (validPaymentMethods !== true) {
      return new NextResponse(
        JSON.stringify({ message: validPaymentMethods }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const [business, user] = await Promise.all([
      Business.findById(businessId).lean(),
      User.findById(userId)
        .select("address personalDetails.firstName personalDetails.lastName username")
        .lean(),
    ]);

    const businessDoc = business as unknown as IBusiness | null;

    if (!businessDoc) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!businessDoc.acceptsDelivery) {
      return new NextResponse(
        JSON.stringify({ message: "This business does not accept delivery." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isDeliveryOpenNow(businessDoc)) {
      return new NextResponse(
        JSON.stringify({ message: "Delivery is currently unavailable." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!user) {
      return new NextResponse(
        JSON.stringify({ message: "User not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const resolvedDeliveryAddress: IAddress | undefined =
      deliveryAddress ?? (user as { address?: IAddress }).address;

    const deliverySalesPoint = (await SalesPoint.findOne({
      businessId,
      salesPointType: "delivery",
    })
      .select("_id")
      .lean()) as { _id: Types.ObjectId } | null;

    if (!deliverySalesPoint?._id) {
      return new NextResponse(
        JSON.stringify({
          message: "Delivery sales point not configured for this business.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const dailySalesReport = (await DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean()) as unknown as IDailySalesReport | null;

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

      const clientNameSource = user as {
        personalDetails?: { firstName?: string; lastName?: string };
        username?: string;
      };
      const clientName =
        clientNameSource.personalDetails?.firstName &&
        clientNameSource.personalDetails?.lastName
          ? `${clientNameSource.personalDetails.firstName} ${clientNameSource.personalDetails.lastName}`
          : clientNameSource.username ?? undefined;

      const newSalesInstanceObj: Partial<ISalesInstance> = {
        dailyReferenceNumber,
        salesPointId: deliverySalesPoint._id,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
        openedAsRole: "customer",
        businessId,
        clientName,
        responsibleByUserId: DELIVERY_ATTRIBUTION_USER_ID,
      };

      const salesInstance = (await createSalesInstance(
        newSalesInstanceObj as ISalesInstance,
        session
      )) as ISalesInstance | string;

      if (typeof salesInstance === "string") {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: salesInstance }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const ordersWithPromotions = await applyPromotionsToOrders({
        businessId,
        ordersArr,
      });

      if (typeof ordersWithPromotions === "string") {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: ordersWithPromotions }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const createdOrders = (await createOrders(
        String(dailyReferenceNumber),
        ordersWithPromotions,
        userId,
        "customer",
        salesInstance._id as Types.ObjectId,
        businessId,
        session
      )) as IOrder[] | string;

      if (typeof createdOrders === "string") {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: createdOrders }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const closeOrdersResult = await closeOrders(
        createdOrders.map((order) => order._id as Types.ObjectId),
        paymentMethodArr,
        session
      );

      if (typeof closeOrdersResult === "string") {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: closeOrdersResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await checkLowStockAndNotify(businessId);

      await session.commitTransaction();
      session.endSession();

      const totalNetPaidAmount = createdOrders.reduce(
        (acc: number, order: { orderNetPrice: number }) =>
          acc + order.orderNetPrice,
        0
      );

      void sendOrderConfirmation(userId, businessId, {
        dailyReferenceNumber,
        totalNetPaidAmount,
        orderCount: createdOrders.length,
      });

      return new NextResponse(
        JSON.stringify({
          message: "Delivery order created successfully.",
          salesInstanceId: salesInstance._id,
          deliveryAddress: resolvedDeliveryAddress,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    return handleApiError("Create delivery order failed!", error as string);
  }
};

