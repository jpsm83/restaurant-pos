import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// import utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { hasManagementRole } from "@/lib/constants";
import { cancelOrders } from "../../orders/utils/cancelOrders";
import { addDiscountToOrders } from "../../orders/utils/addDiscountToOrders";
import { changeOrdersBillingStatus } from "../../orders/utils/changeOrdersBillingStatus";
import { changeOrdersStatus } from "../../orders/utils/changeOrdersStatus";
import { validatePaymentMethodArray } from "../../orders/utils/validatePaymentMethodArray";
import { closeOrders } from "../../orders/utils/closeOrders";
import { transferOrdersBetweenSalesInstances } from "../../orders/utils/transferOrdersBetweenSalesInstances";
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addEmployeeToDailySalesReport";
import { getToken } from "next-auth/jwt";

// import interfaces
import { IPaymentMethod } from "@shared/interfaces/IPaymentMethod";
import { ISalesInstance } from "@shared/interfaces/ISalesInstance";

// import models
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import Employee from "@/lib/db/models/employee";
import BusinessGood from "@/lib/db/models/businessGood";
import Order from "@/lib/db/models/order";
import SalesInstance from "@/lib/db/models/salesInstance";
import SalesPoint from "@/lib/db/models/salesPoint";
import User from "@/lib/db/models/user";

// @desc    Get salesInstances by ID
// @route   GET /salesInstances/:salesInstanceId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
) => {
  try {
    const { salesInstanceId } = await context.params;

    // validate salesInstanceId
    if (isObjectIdValid([salesInstanceId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesInstanceId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const salesInstance = await SalesInstance.findById(salesInstanceId)
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "responsibleByUserId closedByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodId addOns",
        populate: [
          {
            path: "businessGoodId",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
          {
            path: "addOns",
            select: "name mainCategory subCategory allergens sellingPrice",
            model: BusinessGood,
          },
        ],
        model: Order,
      })
      .lean();

    return !salesInstance
      ? new NextResponse(
          JSON.stringify({ message: "SalesLocation not found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesInstance), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Get employee by its id failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

// ******** IMPORTANT ********
// this route will execute the order utils functions

// salesPointId and salesGroup doesnt get updated here, we got separate routes for that
// also sales instance doesnt get closed here, they get closed when all orders are closed automatically
// @desc    Update salesInstances
// @route   PATCH /salesInstances/:salesInstanceId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
) => {
  const { salesInstanceId } = await context.params;

  // calculation of the tableTotalPrice, tableTotalNetPrice, tableTotalNetPaid, tableTotalTips should be done on the front end so employee can see the total price, net price, net paid and tips in real time
  const token = await getToken({
    req: req as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });
  const sessionUserId = token?.id && token.type === "user" ? new Types.ObjectId(token.id as string) : null;

  const {
    ordersIdsArr,
    discountPercentage,
    comments,
    cancel,
    ordersNewBillingStatus,
    voidReason,
    ordersNewStatus,
    paymentMethodArr,
    toSalesInstanceId,
    guests,
    salesInstanceStatus,
    responsibleByUserId,
    clientName,
  } = (await req.json()) as {
    ordersIdsArr: Types.ObjectId[];
    discountPercentage: number;
    comments: string;
    cancel: boolean;
    ordersNewBillingStatus: string;
    voidReason?: string;
    ordersNewStatus: string;
    paymentMethodArr: IPaymentMethod[];
    toSalesInstanceId: Types.ObjectId;
  } & Partial<ISalesInstance>;

  const VOID_REASON_VALUES = ["waste", "mistake", "refund", "other"] as const;

  const idsToValidate = [salesInstanceId];
  if (responsibleByUserId) idsToValidate.push(responsibleByUserId);
  if (ordersIdsArr) idsToValidate.push(...ordersIdsArr);
  if (toSalesInstanceId) idsToValidate.push(toSalesInstanceId);

  // validate ids
  if (isObjectIdValid(idsToValidate) !== true) {
    return new NextResponse(JSON.stringify({ message: "Invalid IDs!" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const salesInstance = (await SalesInstance.findById(salesInstanceId)
      .select("openedByUserId businessId salesInstanceStatus salesGroup")
      .session(session)
      .lean()) as unknown as ISalesInstance | null;

    if (!salesInstance) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "SalesInstance not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle deletion for occupied salesInstance without salesGroup
    if (
      salesInstance.salesInstanceStatus === "Occupied" &&
      (!salesInstance.salesGroup || salesInstance.salesGroup.length === 0) &&
      salesInstanceStatus !== "Reserved"
    ) {
      const deleteResult = await SalesInstance.deleteOne(
        { _id: salesInstanceId },
        { session }
      );

      if (deleteResult.deletedCount === 0) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Empty salesInstance not deleted!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    if (responsibleByUserId && !sessionUserId) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Unauthorized to set responsible user" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (discountPercentage) {
      if (!sessionUserId) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: "Unauthorized; userId from session is required to apply a manual discount!",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const discountEmployee = (await Employee.findOne({
        userId: sessionUserId,
        businessId: salesInstance.businessId,
      })
        .select("allEmployeeRoles")
        .session(session)
        .lean()) as
        | {
            allEmployeeRoles?: string[];
          }
        | null;

      if (!discountEmployee) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Employee not found for this user and business!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!hasManagementRole(discountEmployee.allEmployeeRoles)) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message:
              "Only on-duty management roles can apply manual discounts to orders!",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const addDiscountToOrdersResult = await addDiscountToOrders(
        ordersIdsArr,
        discountPercentage,
        comments,
        session
      );

      if (addDiscountToOrdersResult !== true) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: addDiscountToOrdersResult }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // if cancel is true, cancel orders (management role required)
    if (cancel) {
      if (!sessionUserId) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Unauthorized; userId from session is required to cancel orders!" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      const cancelEmployee = (await Employee.findOne({
        userId: sessionUserId,
        businessId: salesInstance.businessId,
      })
        .select("allEmployeeRoles")
        .session(session)
        .lean()) as { allEmployeeRoles?: string[] } | null;
      if (!cancelEmployee || !hasManagementRole(cancelEmployee.allEmployeeRoles)) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Only on-duty management roles can cancel orders!" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      const cancelOrdersResult = await cancelOrders(ordersIdsArr, session);

      if (cancelOrdersResult !== true) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: cancelOrdersResult }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // if ordersNewBillingStatus is provided, change orders billing status (management role required)
    if (ordersNewBillingStatus) {
      if (!sessionUserId) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Unauthorized; userId from session is required to change order billing status!" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      if (ordersNewBillingStatus === "Void") {
        if (!voidReason || typeof voidReason !== "string" || !VOID_REASON_VALUES.includes(voidReason as (typeof VOID_REASON_VALUES)[number])) {
          await session.abortTransaction();
          return new NextResponse(
            JSON.stringify({ message: "When voiding orders, voidReason is required and must be one of: waste, mistake, refund, other." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }
      const billingEmployee = (await Employee.findOne({
        userId: sessionUserId,
        businessId: salesInstance.businessId,
      })
        .select("allEmployeeRoles")
        .session(session)
        .lean()) as { allEmployeeRoles?: string[] } | null;
      if (!billingEmployee || !hasManagementRole(billingEmployee.allEmployeeRoles)) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Only on-duty management roles can void or set invitation/complimentary orders!" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      const changeOrdersBillingStatusResult = await changeOrdersBillingStatus(
        ordersIdsArr,
        ordersNewBillingStatus,
        session,
        ordersNewBillingStatus === "Void" ? voidReason : undefined
      );

      if (changeOrdersBillingStatusResult !== true) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: changeOrdersBillingStatusResult }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // if ordersNewStatus is provided, change orders status
    if (ordersNewStatus) {
      const changeOrdersStatusResult = await changeOrdersStatus(
        ordersIdsArr,
        ordersNewStatus,
        session
      );

      if (changeOrdersStatusResult !== true) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: changeOrdersStatusResult }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // if paymentMethodArr is provided, update orders payment method
    if (paymentMethodArr) {
      // Validate payment methods
      const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
      if (validPaymentMethods !== true) {
        return new NextResponse(
          JSON.stringify({ message: validPaymentMethods }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const closeOrdersResult = await closeOrders(
        ordersIdsArr,
        paymentMethodArr,
        session
      );

      if (closeOrdersResult !== true) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: closeOrdersResult }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // if toSalesInstanceId is provided, transfer orders to another salesInstance
    // employee can transfer orders between only the salesInstances that are not closed and resposibleById belongs to hin
    if (toSalesInstanceId) {
      const transferOrdersBetweenSalesInstancesResult =
        await transferOrdersBetweenSalesInstances(
          ordersIdsArr,
          toSalesInstanceId,
          session
        );

      if (transferOrdersBetweenSalesInstancesResult !== true) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: transferOrdersBetweenSalesInstancesResult,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // prepare the tableObj to update
    const updatedSalesInstanceObj: Partial<ISalesInstance> = {};

    if (guests) updatedSalesInstanceObj.guests = guests;
    if (salesInstanceStatus)
      updatedSalesInstanceObj.salesInstanceStatus = salesInstanceStatus;
    if (clientName) updatedSalesInstanceObj.clientName = clientName;
    if (responsibleByUserId)
      updatedSalesInstanceObj.responsibleByUserId = responsibleByUserId;

    if (
      responsibleByUserId &&
      responsibleByUserId.toString() !== salesInstance?.openedByUserId?.toString()
    ) {
      const dailySalesReport = await DailySalesReport.exists({
        isDailyReportOpen: true,
        businessId: salesInstance?.businessId,
        "employeesDailySalesReport.userId": responsibleByUserId,
      });

      if (!dailySalesReport) {
        const addResult = await addUserToDailySalesReport(
          responsibleByUserId,
          salesInstance.businessId,
          session
        );

        if (addResult !== true) {
          await session.abortTransaction();
          return new NextResponse(
            JSON.stringify({ message: addResult }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // The order controller would handle the creation of orders and updating the relevant salesInstance's order array. The salesInstance controller would then only be responsible for reading and managing salesInstance data, not order data. This separation of concerns makes the code easier to maintain and understand.

    // save the updated salesInstance
    const updatedSalesInstance = await SalesInstance.updateOne(
      { _id: salesInstanceId },
      { $set: updatedSalesInstanceObj },
      { session }
    );

    if (updatedSalesInstance.modifiedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "SalesInstance not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: "SalesInstance updated successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Update salesInstance failed!",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    session.endSession();
  }
};

// delete a salesInstance shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a salesInstance should be deleted is if the business itself is deleted or if the salesInstance was created by mistake and it has no orders
// @desc    Delete salesInstance
// @route   DELETE /salesInstance/:salesInstanceId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
) => {
  try {
    const { salesInstanceId } = await context.params;

    // validate salesInstanceId
    if (isObjectIdValid([salesInstanceId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesInstanceId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // do not allow delete if salesInstance has salesGroup
    // delete the salesInstance
    const result = await SalesInstance.deleteOne({
      _id: salesInstanceId,
      $or: [{ salesGroup: { $size: 0 } }, { salesGroup: { $exists: false } }],
    });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Sales instance not found or it has orders!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Sales instance deleted successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Fail to delete salesInstance",
      error instanceof Error ? error.message : String(error)
    );
  }
};
