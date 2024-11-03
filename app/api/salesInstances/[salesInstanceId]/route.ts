import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { addEmployeeToDailySalesReport } from "../../dailySalesReports/utils/addEmployeeToDailySalesReport";
import { cancelOrders } from "../../orders/utils/cancelOrders";
import { addDiscountToOrders } from "../../orders/utils/addDiscountToOrders";
import { changeOrdersBillingStatus } from "../../orders/utils/changeOrdersBillingStatus";
import { changeOrdersStatus } from "../../orders/utils/changeOrdersStatus";
import { validatePaymentMethodArray } from "../../orders/utils/validatePaymentMethodArray";
import { closeOrders } from "../../orders/utils/closeOrders";
import { transferOrdersBetweenSalesInstances } from "../../orders/utils/transferOrdersBetweenSalesInstances";

// import interfaces
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Employee from "@/app/lib/models/employee";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";
import SalesPoint from "@/app/lib/models/salesPoint";
import Customer from "@/app/lib/models/customer";

// @desc    Get salesInstances by ID
// @route   GET /salesInstances/:salesInstanceId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
) => {
  try {
    const salesInstanceId = context.params.salesInstanceId;

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

    const salesInstance = await SalesInstance.find()
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedByCustomerId",
        select: "customerName",
        model: Customer,
      })
      .populate({
        path: "openedByEmployeeId responsibleById closedById",
        select: "employeeName currentShiftRole",
        model: Employee,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodsIds",
        populate: {
          path: "businessGoodsIds",
          select: "name mainCategory subCategory allergens sellingPrice",
          model: BusinessGood,
        },
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
    return handleApiError("Get employee by its id failed!", error);
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
  const salesInstanceId = context.params.salesInstanceId;

  // calculation of the tableTotalPrice, tableTotalNetPrice, tableTotalNetPaid, tableTotalTips should be done on the front end so employee can see the total price, net price, net paid and tips in real time
  const {
    ordersIdsArr,
    discountPercentage,
    comments,
    cancel,
    ordersNewBillingStatus,
    ordersNewStatus,
    paymentMethodArr,
    toSalesInstanceId,
    guests,
    salesInstanceStatus,
    responsibleById,
    clientName,
  } = (await req.json()) as {
    ordersIdsArr: Types.ObjectId[];
    discountPercentage: number;
    comments: string;
    cancel: boolean;
    ordersNewBillingStatus: string;
    ordersNewStatus: string;
    paymentMethodArr: IPaymentMethod[];
    toSalesInstanceId: Types.ObjectId;
  } & Partial<ISalesInstance>;

  // Validate ObjectIds in one step for better performance
  const idsToValidate = [salesInstanceId];
  if (responsibleById) idsToValidate.push(responsibleById);
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
    // get the salesInstance
    const salesInstance: ISalesInstance | null = await SalesInstance.findById(
      salesInstanceId
    )
      .select("openedByEmployeeId businessId salesInstanceStatus salesGroup")
      .session(session)
      .lean();

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

    // check if responsibleById is an employee
    if (responsibleById) {
      const employee = await Employee.findById(responsibleById);

      if (!employee) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Employee not found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // // if discountPercentage is provided, add discount to orders
    // if (discountPercentage) {
    //   const addDiscountToOrdersResult = await addDiscountToOrders(
    //     ordersIdsArr,
    //     discountPercentage,
    //     comments,
    //     session
    //   );

    //   if (addDiscountToOrdersResult !== true) {
    //     await session.abortTransaction();
    //     return new NextResponse(
    //       JSON.stringify({ message: addDiscountToOrdersResult }),
    //       {
    //         status: 400,
    //         headers: { "Content-Type": "application/json" },
    //       }
    //     );
    //   }
    // }

    // // if cancel is true, cancel orders
    // if (cancel) {
    //   const cancelOrdersResult = await cancelOrders(ordersIdsArr, session);

    //   if (cancelOrdersResult !== true) {
    //     await session.abortTransaction();
    //     return new NextResponse(
    //       JSON.stringify({ message: cancelOrdersResult }),
    //       {
    //         status: 400,
    //         headers: { "Content-Type": "application/json" },
    //       }
    //     );
    //   }
    // }

    // // if ordersNewBillingStatus is provided, change orders billing status
    // if (ordersNewBillingStatus) {
    //   const changeOrdersBillingStatusResult = await changeOrdersBillingStatus(
    //     ordersIdsArr,
    //     ordersNewBillingStatus,
    //     session
    //   );

    //   if (changeOrdersBillingStatusResult !== true) {
    //     await session.abortTransaction();
    //     return new NextResponse(
    //       JSON.stringify({ message: changeOrdersBillingStatusResult }),
    //       {
    //         status: 400,
    //         headers: { "Content-Type": "application/json" },
    //       }
    //     );
    //   }
    // }

    // // if ordersNewStatus is provided, change orders status
    // if (ordersNewStatus) {
    //   const changeOrdersStatusResult = await changeOrdersStatus(
    //     ordersIdsArr,
    //     ordersNewStatus,
    //     session
    //   );

    //   if (changeOrdersStatusResult !== true) {
    //     await session.abortTransaction();
    //     return new NextResponse(
    //       JSON.stringify({ message: changeOrdersStatusResult }),
    //       {
    //         status: 400,
    //         headers: { "Content-Type": "application/json" },
    //       }
    //     );
    //   }
    // }

    // // if paymentMethodArr is provided, update orders payment method
    // if (paymentMethodArr) {
    //   // Validate payment methods
    //   const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
    //   if (validPaymentMethods !== true) {
    //     return new NextResponse(
    //       JSON.stringify({ message: validPaymentMethods }),
    //       {
    //         status: 400,
    //         headers: { "Content-Type": "application/json" },
    //       }
    //     );
    //   }

    //   const closeOrdersResult = await closeOrders(
    //     ordersIdsArr,
    //     paymentMethodArr,
    //     session
    //   );

    //   if (closeOrdersResult !== true) {
    //     await session.abortTransaction();
    //     return new NextResponse(
    //       JSON.stringify({ message: closeOrdersResult }),
    //       {
    //         status: 400,
    //         headers: { "Content-Type": "application/json" },
    //       }
    //     );
    //   }
    // }

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

    // // prepare the tableObj to update
    // let updatedSalesInstanceObj: Partial<ISalesInstance> = {};

    // if (guests) updatedSalesInstanceObj.guests = guests;
    // if (salesInstanceStatus)
    //   updatedSalesInstanceObj.salesInstanceStatus = salesInstanceStatus;
    // if (clientName) updatedSalesInstanceObj.clientName = clientName;
    // if (responsibleById)
    //   updatedSalesInstanceObj.responsibleById = responsibleById;
    // // if salesInstance is transferred to another employee, and that is the first salesInstance from the new employee, update the dailySalesReport to create a new employeeDailySalesReport for the new employee
    // if (
    //   responsibleById &&
    //   responsibleById !== salesInstance?.openedByEmployeeId
    // ) {
    //   // check if employee exists in the dailySalesReport
    //   if (
    //     !(await DailySalesReport.exists({
    //       isDailyReportOpen: true,
    //       business: salesInstance?.businessId,
    //       "employeesDailySalesReport.employeeId": responsibleById,
    //     }))
    //   ) {
    //     const addEmployeeToDailySalesReportResult =
    //       await addEmployeeToDailySalesReport(
    //         responsibleById,
    //         salesInstance.businessId,
    //         session
    //       );

    //     if (addEmployeeToDailySalesReportResult !== true) {
    //       await session.abortTransaction();
    //       return new NextResponse(
    //         JSON.stringify({ message: addEmployeeToDailySalesReportResult }),
    //         {
    //           status: 400,
    //           headers: { "Content-Type": "application/json" },
    //         }
    //       );
    //     }
    //   }
    // }

    // // The order controller would handle the creation of orders and updating the relevant salesInstance's order array. The salesInstance controller would then only be responsible for reading and managing salesInstance data, not order data. This separation of concerns makes the code easier to maintain and understand.

    // // save the updated salesInstance
    // const updatedSalesInstance = await SalesInstance.updateOne(
    //   { _id: salesInstanceId },
    //   { $set: updatedSalesInstanceObj },
    //   { session }
    // );

    // if (updatedSalesInstance.modifiedCount === 0) {
    //   await session.abortTransaction();
    //   return new NextResponse(
    //     JSON.stringify({ message: "SalesInstance not found!" }),
    //     {
    //       status: 404,
    //       headers: { "Content-Type": "application/json" },
    //     }
    //   );
    // }

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
    return handleApiError("Update salesInstance failed!", error);
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
    const salesInstanceId = context.params.salesInstanceId;

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
    return handleApiError("Fail to delete salesInstance", error);
  }
};
