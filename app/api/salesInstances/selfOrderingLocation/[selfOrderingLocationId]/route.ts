import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { createDailySalesReport } from "@/app/api/dailySalesReports/utils/createDailySalesReport";
import { createSalesInstance } from "../../utils/createSalesInstance";
import { ordersArrValidation } from "@/app/api/orders/utils/validateOrdersArr";
import { createOrders } from "@/app/api/orders/utils/createOrders";
import { closeOrders } from "@/app/api/orders/utils/closeOrders";

// import interfaces
import {
  IDailySalesReport,
  IGoodsReduced,
} from "@/app/lib/interface/IDailySalesReport";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";
import { IOrder } from "@/app/lib/interface/IOrder";
import { ICustomer } from "@/app/lib/interface/ICustomer";
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Customer from "@/app/lib/models/customer";
import { validatePaymentMethodArray } from "@/app/api/orders/utils/validatePaymentMethodArray";

// first create a empty salesInstance, then update it with the salesGroup.ordersIds
// @desc    Create new salesInstances
// @route   POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId
// @access  Private

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
  //       businessGoodsIds, - can be an array of businessId goods (3 IDs) "burger with extra cheese and add bacon"
  //       allergens,
  //       promotionApplyed, - automatically set by the front_end upon creation
  //       comments
  //       discountPercentage
  //    }
  //]

  const { businessId, ordersArr, openedByCustomerId, paymentMethodArr } =
    (await req.json()) as Partial<ISalesInstance> & {
      ordersArr: IOrder[];
      paymentMethodArr: IPaymentMethod[];
    };

  // check required fields
  if (
    !selfOrderingLocationId ||
    !openedByCustomerId ||
    !businessId ||
    !ordersArr ||
    !paymentMethodArr
  ) {
    return new NextResponse(
      JSON.stringify({
        message:
          "SelfOrderingLocationId, ordersArr, paymentMethodArr, openedByCustomerId and businessId are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate IDs
  const objectIds = [
    ...ordersArr.flatMap((order) => order.businessGoodsIds),
    businessId,
    openedByCustomerId,
    selfOrderingLocationId,
  ];

  // validate ids
  if (isObjectIdValid(objectIds) !== true) {
    return new NextResponse(
      JSON.stringify({
        message:
          "BusinessId, openedByCustomerId, selfOrderingLocationId or ordersArr's IDs not valid!",
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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // all db calls in one promise
    const [customer, dailySalesReport] = await Promise.all([
      // check customer exists
      Customer.findById(openedByCustomerId)
        .select("customerName")
        .lean() as Promise<ICustomer>,

      // check if dailySalesReport exists
      DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean() as Promise<IDailySalesReport>,
    ]);

    if (!customer) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Customer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

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

    // create new salesInstance
    const newSalesInstanceObj = {
      dailyReferenceNumber,
      salesPointId: selfOrderingLocationId,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedByCustomerId,
      businessId,
      clientName: customer?.customerName,
    };

    // create a salesInstance
    // we use a outside function to create the salesInstance because this function is used in other places
    const salesInstance: any = await createSalesInstance(newSalesInstanceObj, session);

    if (typeof salesInstance === "string") {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: salesInstance }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // create orders
    // inventory will be updated in this function
    const createdOrders: any = await createOrders(
      dailyReferenceNumber,
      ordersArr,
      undefined,
      openedByCustomerId,
      salesInstance._id,
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

    let createdOrdersIds = createdOrders.map(
      (order: { _id: Types.ObjectId }) => order._id
    );

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

    let soldGoods: IGoodsReduced[] = [];

    // Assuming ordersArr is an array of orders
    ordersArr.forEach((order) => {
      order.businessGoodsIds.forEach((goodId) => {
        let existingGood = soldGoods.find(
          (good) => good.businessGoodId === goodId
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

    // update dailySalesReport adding the customerId and the purchase details
    const dailySalesReportUpdate = await DailySalesReport.updateOne(
      { dailyReferenceNumber: dailyReferenceNumber },
      {
        $push: {
          selfOrderingSalesReport: {
            customerId: openedByCustomerId,
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

    return new NextResponse(
      JSON.stringify({ message: "Customer self ordering created" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Create salesInstance failed!", error);
  } finally {
    session.endSession();
  }
};
