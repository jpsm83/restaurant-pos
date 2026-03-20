import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IDailySalesReport, IGoodsReduced } from "@shared/interfaces/IDailySalesReport";
import type { ISalesInstance } from "@shared/interfaces/ISalesInstance";
import type { IPaymentMethod } from "@shared/interfaces/IPaymentMethod";
import type { IOrder } from "@shared/interfaces/IOrder";
import type { IAddress } from "@shared/interfaces/IAddress";
import type { IBusiness } from "@shared/interfaces/IBusiness";

import { isObjectIdValid } from "../../utils/isObjectIdValid.ts";
import { managementRolesEnums } from "../../../lib/enums.ts";
import { isBusinessOpenNow, isDeliveryOpenNow } from "../../business/isBusinessOpenNow.ts";
import SalesInstance from "../../models/salesInstance.ts";
import SalesPoint from "../../models/salesPoint.ts";
import User from "../../models/user.ts";
import Order from "../../models/order.ts";
import BusinessGood from "../../models/businessGood.ts";
import Employee from "../../models/employee.ts";
import DailySalesReport from "../../models/dailySalesReport.ts";
import Reservation from "../../models/reservation.ts";
import Business from "../../models/business.ts";
import { createDailySalesReport } from "../../dailySalesReports/createDailySalesReport.ts";
import { createSalesInstance } from "../../salesInstances/createSalesInstance.ts";
import { cancelOrders } from "../../orders/cancelOrders.ts";
import { closeOrders } from "../../orders/closeOrders.ts";
import { createAuthHook, createOptionalAuthHook } from "../../auth/middleware.ts";
import { transferOrdersBetweenSalesInstances } from "../../orders/transferOrdersBetweenSalesInstances.ts";
import { validatePaymentMethodArray } from "../../orders/validatePaymentMethodArray.ts";
import { ordersArrValidation } from "../../orders/ordersArrValidation.ts";
import { createOrders } from "../../orders/createOrders.ts";
import { applyPromotionsToOrders } from "../../promotions/applyPromotions.ts";
import { checkLowStockAndNotify } from "../../inventories/checkLowStockAndNotify.ts";
import { sendOrderConfirmation } from "../../orderConfirmation/sendOrderConfirmation.ts";

export const salesInstancesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_req, reply) => {
    const salesInstances = await SalesInstance.find()
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

    if (!salesInstances?.length) {
      return reply.code(404).send({ message: "No salesInstances found!" });
    }
    return reply.code(200).send(salesInstances);
  });

  app.post("/", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const openedByUserId = new Types.ObjectId(req.authSession.id);

    const body = req.body as Partial<ISalesInstance>;
    const { salesPointId, guests, salesInstanceStatus, businessId, clientName } =
      body ?? {};

    if (!salesPointId || !guests || !businessId) {
      return reply
        .code(400)
        .send({ message: "SalesPointId, guests and businessId are required!" });
    }

    if (isObjectIdValid([salesPointId as any, businessId as any]) !== true) {
      return reply.code(400).send({ message: "SalesPointId or businessId not valid!" });
    }

    const employee = (await Employee.findOne({
      userId: openedByUserId,
      businessId,
    })
      .select("onDuty")
      .lean()) as { onDuty: boolean } | null;

    if (!employee || !employee.onDuty) {
      return reply.code(403).send({
        message: "You must be an on-duty employee to open a table from the POS.",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [salesPoint, dailySalesReport] = await Promise.all([
        SalesPoint.exists({ _id: salesPointId }).session(session),
        DailySalesReport.findOne({ isDailyReportOpen: true, businessId })
          .select("dailyReferenceNumber")
          .session(session)
          .lean() as unknown as Promise<IDailySalesReport | null>,
      ]);

      if (!salesPoint) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Sales point does not exist!" });
      }

      const dailyReferenceNumber = dailySalesReport
        ? (dailySalesReport as any).dailyReferenceNumber
        : await createDailySalesReport(businessId as any, session);

      if (typeof dailyReferenceNumber === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: dailyReferenceNumber });
      }

      const existingOpen = await SalesInstance.exists({
        dailyReferenceNumber,
        businessId,
        salesPointId,
        salesInstanceStatus: { $ne: "Closed" },
      }).session(session);

      if (existingOpen) {
        await session.abortTransaction();
        return reply
          .code(409)
          .send({ message: "SalesInstance already exists and it is not closed!" });
      }

      const newSalesInstanceObj: ISalesInstance = {
        dailyReferenceNumber: dailyReferenceNumber as any,
        salesPointId: salesPointId as any,
        guests: guests as any,
        salesInstanceStatus: (salesInstanceStatus as any) ?? "Occupied",
        openedByUserId: openedByUserId as any,
        openedAsRole: "employee",
        businessId: businessId as any,
        clientName: clientName as any,
      } as ISalesInstance;

      const result = await createSalesInstance(newSalesInstanceObj, session);
      if (typeof result === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: result });
      }

      await session.commitTransaction();
      return reply.code(201).send({ message: "SalesInstance created successfully!" });
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  });

  app.get("/:salesInstanceId", async (req, reply) => {
    const params = req.params as { salesInstanceId?: string };
    const salesInstanceId = params.salesInstanceId;

    if (!salesInstanceId || isObjectIdValid([salesInstanceId]) !== true) {
      return reply.code(400).send({ message: "Invalid salesInstanceId!" });
    }

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

    if (!salesInstance) {
      return reply.code(404).send({ message: "SalesLocation not found!" });
    }

    return reply.code(200).send(salesInstance);
  });

  app.patch("/:salesInstanceId", { preValidation: [createOptionalAuthHook(app)] }, async (req, reply) => {
    const params = req.params as { salesInstanceId?: string };
    const salesInstanceId = params.salesInstanceId;

    const sessionUserId =
      req.authSession?.type === "user"
        ? new Types.ObjectId(req.authSession.id)
        : null;

    const body = req.body as {
      ordersIdsArr?: string[];
      discountPercentage?: number;
      comments?: string;
      cancel?: boolean;
      ordersNewBillingStatus?: string;
      voidReason?: string;
      ordersNewStatus?: string;
      paymentMethodArr?: IPaymentMethod[];
      toSalesInstanceId?: string;
      guests?: number;
      salesInstanceStatus?: string;
      responsibleByUserId?: string;
      clientName?: string;
    };

    const {
      ordersIdsArr,
      cancel,
      paymentMethodArr,
      toSalesInstanceId,
      guests,
      salesInstanceStatus,
      responsibleByUserId,
      clientName,
    } = body;

    const idsToValidate: (string | Types.ObjectId)[] = [salesInstanceId!];
    if (responsibleByUserId) idsToValidate.push(responsibleByUserId);
    if (ordersIdsArr) idsToValidate.push(...ordersIdsArr);
    if (toSalesInstanceId) idsToValidate.push(toSalesInstanceId);

    if (isObjectIdValid(idsToValidate as Types.ObjectId[]) !== true) {
      return reply.code(400).send({ message: "Invalid IDs!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const salesInstance = (await SalesInstance.findById(salesInstanceId)
        .select("openedByUserId businessId salesInstanceStatus salesGroup")
        .session(session)
        .lean()) as unknown as ISalesInstance | null;

      if (!salesInstance) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "SalesInstance not found!" });
      }

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
          return reply.code(404).send({ message: "Empty salesInstance not deleted!" });
        }
      }

      if (responsibleByUserId && !sessionUserId) {
        await session.abortTransaction();
        return reply.code(401).send({ message: "Unauthorized to set responsible user" });
      }

      if (cancel && ordersIdsArr) {
        if (!sessionUserId) {
          await session.abortTransaction();
          return reply.code(401).send({
            message: "Unauthorized; userId from session is required to cancel orders!",
          });
        }
        const cancelEmployee = (await Employee.findOne({
          userId: sessionUserId,
          businessId: salesInstance.businessId,
        })
          .select("allEmployeeRoles")
          .session(session)
          .lean()) as { allEmployeeRoles?: string[] } | null;

        if (!cancelEmployee || !managementRolesEnums.some((role) => cancelEmployee.allEmployeeRoles?.includes(role))) {
          await session.abortTransaction();
          return reply.code(403).send({
            message: "Only on-duty management roles can cancel orders!",
          });
        }

        const cancelOrdersResult = await cancelOrders(
          ordersIdsArr.map((id) => new Types.ObjectId(id)),
          session
        );

        if (cancelOrdersResult !== true) {
          await session.abortTransaction();
          return reply.code(400).send({ message: cancelOrdersResult });
        }
      }

      if (paymentMethodArr && ordersIdsArr) {
        const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
        if (validPaymentMethods !== true) {
          await session.abortTransaction();
          return reply.code(400).send({ message: validPaymentMethods });
        }

        const closeOrdersResult = await closeOrders(
          ordersIdsArr.map((id) => new Types.ObjectId(id)),
          paymentMethodArr,
          session
        );

        if (closeOrdersResult !== true) {
          await session.abortTransaction();
          return reply.code(400).send({ message: closeOrdersResult });
        }
      }

      if (toSalesInstanceId && ordersIdsArr) {
        const transferResult = await transferOrdersBetweenSalesInstances(
          ordersIdsArr.map((id) => new Types.ObjectId(id)),
          new Types.ObjectId(toSalesInstanceId),
          session
        );

        if (transferResult !== true) {
          await session.abortTransaction();
          return reply.code(400).send({ message: transferResult });
        }
      }

      const updatedSalesInstanceObj: Partial<ISalesInstance> = {};

      if (guests) updatedSalesInstanceObj.guests = guests;
      if (salesInstanceStatus)
        updatedSalesInstanceObj.salesInstanceStatus = salesInstanceStatus as ISalesInstance["salesInstanceStatus"];
      if (clientName) updatedSalesInstanceObj.clientName = clientName;
      if (responsibleByUserId)
        updatedSalesInstanceObj.responsibleByUserId = new Types.ObjectId(responsibleByUserId) as any;

      const updatedSalesInstance = await SalesInstance.updateOne(
        { _id: salesInstanceId },
        { $set: updatedSalesInstanceObj },
        { session }
      );

      if (updatedSalesInstance.modifiedCount === 0 && Object.keys(updatedSalesInstanceObj).length > 0) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "SalesInstance not found!" });
      }

      await session.commitTransaction();

      return reply.code(200).send({ message: "SalesInstance updated successfully!" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Update salesInstance failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  app.delete("/:salesInstanceId", async (req, reply) => {
    const params = req.params as { salesInstanceId?: string };
    const salesInstanceId = params.salesInstanceId;

    if (!salesInstanceId || isObjectIdValid([salesInstanceId]) !== true) {
      return reply.code(400).send({ message: "Invalid salesInstanceId" });
    }

    const result = await SalesInstance.deleteOne({
      _id: salesInstanceId,
      $or: [{ salesGroup: { $size: 0 } }, { salesGroup: { $exists: false } }],
    });

    if (result.deletedCount === 0) {
      return reply.code(404).send({
        message: "Sales instance not found or it has orders!",
      });
    }

    return reply.code(200).send({ message: "Sales instance deleted successfully!" });
  });

  app.patch("/:salesInstanceId/transferSalesPoint", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    const params = req.params as { salesInstanceId?: string };
    const salesInstanceId = params.salesInstanceId;

    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const sessionUserId = new Types.ObjectId(req.authSession.id);

    const body = req.body as { salesPointId?: string };
    const { salesPointId } = body;

    if (!salesPointId) {
      return reply.code(400).send({ message: "salesPointId is required!" });
    }

    if (isObjectIdValid([salesInstanceId!, salesPointId]) !== true) {
      return reply.code(400).send({ message: "Invalid IDs!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const salesInstance = (await SalesInstance.findById(salesInstanceId)
        .select("businessId dailyReferenceNumber salesInstanceStatus salesPointId reservationId")
        .session(session)
        .lean()) as unknown as {
        _id: Types.ObjectId;
        businessId: Types.ObjectId;
        dailyReferenceNumber: number;
        salesInstanceStatus: string;
        salesPointId: Types.ObjectId;
        reservationId?: Types.ObjectId;
      } | null;

      if (!salesInstance) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "SalesInstance not found!" });
      }

      if (salesInstance.salesInstanceStatus === "Closed") {
        await session.abortTransaction();
        return reply.code(409).send({ message: "SalesInstance is closed!" });
      }

      const employee = (await Employee.findOne({
        userId: sessionUserId,
        businessId: salesInstance.businessId,
      })
        .select("allEmployeeRoles")
        .session(session)
        .lean()) as unknown as { allEmployeeRoles?: string[] } | null;

      const isAllowed =
        (employee?.allEmployeeRoles || []).includes("Host") ||
        managementRolesEnums.some((role) => employee?.allEmployeeRoles?.includes(role));

      if (!isAllowed) {
        await session.abortTransaction();
        return reply.code(403).send({ message: "Forbidden" });
      }

      const sp = await SalesPoint.exists({
        _id: salesPointId,
        businessId: salesInstance.businessId,
      }).session(session);

      if (!sp) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "SalesPoint not found for this business!" });
      }

      const openConflict = await SalesInstance.exists({
        _id: { $ne: salesInstanceId },
        dailyReferenceNumber: salesInstance.dailyReferenceNumber,
        businessId: salesInstance.businessId,
        salesPointId,
        salesInstanceStatus: { $ne: "Closed" },
      }).session(session);

      if (openConflict) {
        await session.abortTransaction();
        return reply.code(409).send({
          message: "Cannot move to this salesPoint because it already has an open SalesInstance!",
        });
      }

      const moved = await SalesInstance.updateOne(
        { _id: salesInstanceId },
        { $set: { salesPointId } },
        { session }
      );

      if (moved.modifiedCount !== 1) {
        await session.abortTransaction();
        return reply.code(400).send({ message: "SalesInstance not moved!" });
      }

      const reservation = (await Reservation.findOne({
        $or: [
          { salesInstanceId: salesInstanceId },
          { _id: salesInstance.reservationId },
        ],
      })
        .select("_id status")
        .session(session)
        .lean()) as { _id: Types.ObjectId; status?: string } | null;

      if (reservation) {
        await Reservation.updateOne(
          { _id: reservation._id },
          { $set: { salesPointId } },
          { session }
        );
      }

      await session.commitTransaction();
      return reply.code(200).send({ message: "SalesInstance transferred successfully!" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Transfer SalesInstance salesPoint failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  app.get("/business/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid salesInstanceId!" });
    }

    const salesInstances = await SalesInstance.find({ businessId })
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

    if (!salesInstances.length) {
      return reply.code(404).send({ message: "No salesInstances found!" });
    }

    return reply.code(200).send(salesInstances);
  });

  app.get("/user/:userId", async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId;

    if (!userId || isObjectIdValid([userId]) !== true) {
      return reply.code(400).send({ message: "Invalid userId!" });
    }

    const salesInstances = await SalesInstance.find({
      $or: [{ openedByUserId: userId }, { responsibleByUserId: userId }],
    })
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

    if (!salesInstances.length) {
      return reply.code(404).send({ message: "No salesInstances found!" });
    }

    return reply.code(200).send(salesInstances);
  });

  app.post("/selfOrderingLocation/:selfOrderingLocationId/openTable", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    const params = req.params as { selfOrderingLocationId?: string };
    const selfOrderingLocationId = params.selfOrderingLocationId;

    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const openedByUserId = new Types.ObjectId(req.authSession.id);

    const body = req.body as { businessId?: string; guests?: number };
    const businessId = body?.businessId;
    const guests = body?.guests ?? 1;

    if (!businessId) {
      return reply.code(400).send({ message: "businessId is required" });
    }

    if (isObjectIdValid([selfOrderingLocationId!, businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid selfOrderingLocationId or businessId" });
    }

    const salesPoint = (await SalesPoint.findById(selfOrderingLocationId)
      .select("businessId")
      .lean()) as { businessId: Types.ObjectId | { _id: Types.ObjectId } } | null;

    if (!salesPoint) {
      return reply.code(404).send({ message: "Sales point not found" });
    }

    const salesPointBusinessId =
      typeof salesPoint.businessId === "object" &&
      salesPoint.businessId !== null &&
      "_id" in salesPoint.businessId
        ? (salesPoint.businessId as { _id: Types.ObjectId })._id
        : (salesPoint.businessId as Types.ObjectId);

    if (salesPointBusinessId.toString() !== businessId.toString()) {
      return reply.code(400).send({ message: "Sales point does not belong to this business" });
    }

    const employee = (await Employee.findOne({
      userId: openedByUserId,
      businessId,
    })
      .select("onDuty")
      .lean()) as { onDuty: boolean } | null;

    if (!employee || !employee.onDuty) {
      return reply.code(403).send({ message: "Employee must be on duty to open a table from QR" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const dailySalesReport = (await DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .session(session)
        .lean()) as unknown as (Pick<IDailySalesReport, "dailyReferenceNumber"> & { _id: unknown }) | null;

      const dailyReferenceNumber = dailySalesReport
        ? dailySalesReport.dailyReferenceNumber
        : await createDailySalesReport(new Types.ObjectId(businessId), session);

      if (typeof dailyReferenceNumber === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: dailyReferenceNumber });
      }

      const existingOpen = await SalesInstance.exists({
        dailyReferenceNumber,
        businessId,
        salesPointId: selfOrderingLocationId,
        salesInstanceStatus: { $ne: "Closed" },
      }).session(session);

      if (existingOpen) {
        await session.abortTransaction();
        return reply.code(409).send({
          message: "SalesInstance already exists and it is not closed!",
        });
      }

      const newSalesInstanceObj: ISalesInstance = {
        dailyReferenceNumber,
        salesPointId: new Types.ObjectId(selfOrderingLocationId),
        guests,
        salesInstanceStatus: "Occupied",
        openedByUserId,
        openedAsRole: "employee",
        businessId: new Types.ObjectId(businessId),
      } as ISalesInstance;

      const result = await createSalesInstance(newSalesInstanceObj, session);
      if (typeof result === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: result });
      }

      await session.commitTransaction();
      return reply.code(201).send(result);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  });

  app.post("/delivery", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const userId = new Types.ObjectId(req.authSession.id);

    const body = req.body as {
      businessId: Types.ObjectId;
      ordersArr: IOrder[];
      paymentMethodArr: IPaymentMethod[];
      deliveryAddress?: IAddress;
    };

    const { businessId, ordersArr, paymentMethodArr, deliveryAddress } = body ?? {};

    if (!businessId || !ordersArr || !paymentMethodArr) {
      return reply.code(400).send({
        message: "businessId, ordersArr and paymentMethodArr are required for delivery orders!",
      });
    }

    const objectIds = [
      businessId,
      ...ordersArr.flatMap((order) => [
        order.businessGoodId!,
        ...(order.addOns ?? []),
      ]),
    ];

    if (isObjectIdValid(objectIds as Types.ObjectId[]) !== true) {
      return reply.code(400).send({
        message: "businessId or ordersArr's IDs not valid!",
      });
    }

    const ordersArrValidationResult = ordersArrValidation(ordersArr);
    if (ordersArrValidationResult !== true) {
      return reply.code(400).send({ message: ordersArrValidationResult });
    }

    const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
    if (validPaymentMethods !== true) {
      return reply.code(400).send({ message: validPaymentMethods });
    }

    const [business, user] = await Promise.all([
      Business.findById(businessId).lean(),
      User.findById(userId)
        .select("address personalDetails.firstName personalDetails.lastName username")
        .lean(),
    ]);

    const businessDoc = business as unknown as IBusiness | null;

    if (!businessDoc) {
      return reply.code(404).send({ message: "Business not found." });
    }

    if (!businessDoc.acceptsDelivery) {
      return reply.code(400).send({ message: "This business does not accept delivery." });
    }

    if (!isDeliveryOpenNow(businessDoc)) {
      return reply.code(403).send({ message: "Delivery is currently unavailable." });
    }

    if (!user) {
      return reply.code(404).send({ message: "User not found!" });
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
      return reply.code(400).send({
        message: "Delivery sales point not configured for this business.",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const dailySalesReport = (await DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .session(session)
        .lean()) as unknown as IDailySalesReport | null;

      const dailyReferenceNumber = dailySalesReport
        ? dailySalesReport.dailyReferenceNumber
        : await createDailySalesReport(businessId as Types.ObjectId, session);

      if (typeof dailyReferenceNumber === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: dailyReferenceNumber });
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
        businessId: businessId as Types.ObjectId,
        clientName,
        responsibleByUserId: DELIVERY_ATTRIBUTION_USER_ID,
      };

      const salesInstance = (await createSalesInstance(
        newSalesInstanceObj as ISalesInstance,
        session
      )) as ISalesInstance | string;

      if (typeof salesInstance === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: salesInstance });
      }

      const ordersWithPromotions = await applyPromotionsToOrders({
        businessId: businessId as Types.ObjectId,
        ordersArr,
        session,
      });

      if (typeof ordersWithPromotions === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: ordersWithPromotions });
      }

      const createdOrders = (await createOrders(
        String(dailyReferenceNumber),
        ordersWithPromotions as IOrder[],
        userId,
        "customer",
        salesInstance._id as Types.ObjectId,
        businessId as Types.ObjectId,
        session
      )) as IOrder[] | string;

      if (typeof createdOrders === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: createdOrders });
      }

      const closeOrdersResult = await closeOrders(
        createdOrders.map((order) => order._id as Types.ObjectId),
        paymentMethodArr,
        session
      );

      if (typeof closeOrdersResult === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: closeOrdersResult });
      }

      await session.commitTransaction();
      session.endSession();

      checkLowStockAndNotify(businessId as Types.ObjectId).catch(() => {});

      const totalNetPaidAmount = createdOrders.reduce(
        (acc: number, order: { orderNetPrice: number }) =>
          acc + order.orderNetPrice,
        0
      );

      sendOrderConfirmation(userId, businessId as Types.ObjectId, {
        dailyReferenceNumber,
        totalNetPaidAmount,
        orderCount: createdOrders.length,
      }).catch(() => {});

      return reply.code(201).send({
        message: "Delivery order created successfully.",
        salesInstanceId: salesInstance._id,
        deliveryAddress: resolvedDeliveryAddress,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return reply.code(500).send({
        message: "Create delivery order failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  app.post("/selfOrderingLocation/:selfOrderingLocationId", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    const params = req.params as { selfOrderingLocationId?: string };
    const selfOrderingLocationId = params.selfOrderingLocationId;

    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const userId = new Types.ObjectId(req.authSession.id);

    const body = req.body as Partial<ISalesInstance> & {
      ordersArr: IOrder[];
      paymentMethodArr: IPaymentMethod[];
    };

    const { businessId, ordersArr, paymentMethodArr } = body ?? {};

    if (!selfOrderingLocationId || !businessId || !ordersArr || !paymentMethodArr) {
      return reply.code(400).send({
        message: "SelfOrderingLocationId, ordersArr, paymentMethodArr and businessId are required!",
      });
    }

    const objectIds = [
      ...ordersArr.flatMap((order) => [
        order.businessGoodId!,
        ...(order.addOns ?? []),
      ]),
      businessId,
      selfOrderingLocationId,
    ];

    if (isObjectIdValid(objectIds as Types.ObjectId[]) !== true) {
      return reply.code(400).send({
        message: "BusinessId, selfOrderingLocationId or ordersArr's IDs not valid!",
      });
    }

    const ordersArrValidationResult = ordersArrValidation(ordersArr);
    if (ordersArrValidationResult !== true) {
      return reply.code(400).send({ message: ordersArrValidationResult });
    }

    const validPaymentMethods = validatePaymentMethodArray(paymentMethodArr);
    if (validPaymentMethods !== true) {
      return reply.code(400).send({ message: validPaymentMethods });
    }

    const salesPoint = (await SalesPoint.findById(selfOrderingLocationId)
      .select("selfOrdering businessId")
      .lean()) as {
      selfOrdering: boolean;
      businessId: Types.ObjectId | { _id: Types.ObjectId };
    } | null;

    if (!salesPoint || salesPoint.selfOrdering !== true) {
      return reply.code(400).send({
        message: "Self-ordering is not available at this table.",
      });
    }

    const salesPointBusinessId =
      typeof salesPoint.businessId === "object" &&
      salesPoint.businessId !== null &&
      "_id" in salesPoint.businessId
        ? (salesPoint.businessId as { _id: Types.ObjectId })._id
        : (salesPoint.businessId as Types.ObjectId);

    if (salesPointBusinessId.toString() !== businessId.toString()) {
      return reply.code(400).send({ message: "Sales point does not belong to this business." });
    }

    const business = (await Business.findById(businessId).lean()) as unknown as IBusiness | null;
    if (!business) {
      return reply.code(404).send({ message: "Business not found." });
    }
    if (!isBusinessOpenNow(business)) {
      return reply.code(403).send({
        message: "Business is currently closed for service.",
      });
    }

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
        return reply.code(409).send({
          message:
            "Table is being served by staff. Self-ordering is not available until the table is closed.",
        });
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [user, dailySalesReport] = await Promise.all([
        User.findById(userId)
          .select("personalDetails.firstName personalDetails.lastName username")
          .session(session)
          .lean(),
        DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId,
        })
          .select("dailyReferenceNumber")
          .session(session)
          .lean() as unknown as Promise<IDailySalesReport | null>,
      ]);

      if (!user) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "User not found!" });
      }

      const userObj = user as { personalDetails?: { firstName?: string; lastName?: string }; username?: string } | null;
      const clientName =
        userObj?.personalDetails?.firstName && userObj?.personalDetails?.lastName
          ? `${userObj.personalDetails.firstName} ${userObj.personalDetails.lastName}`
          : userObj?.username ?? undefined;

      const dailyReferenceNumber = dailySalesReport
        ? dailySalesReport.dailyReferenceNumber
        : await createDailySalesReport(businessId as Types.ObjectId, session);

      if (typeof dailyReferenceNumber === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: dailyReferenceNumber });
      }

      const newSalesInstanceObj = {
        dailyReferenceNumber,
        salesPointId: new Types.ObjectId(selfOrderingLocationId),
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
        openedAsRole: "customer" as const,
        businessId: new Types.ObjectId(businessId as string),
        clientName,
      };

      const salesInstance = await createSalesInstance(newSalesInstanceObj as ISalesInstance, session) as ISalesInstance | string;

      if (typeof salesInstance === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: salesInstance });
      }

      const pricedOrders = await applyPromotionsToOrders({
        businessId: new Types.ObjectId(businessId as string),
        ordersArr,
        session,
      });

      if (typeof pricedOrders === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: pricedOrders });
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
          return reply.code(400).send({
            message: "Order price or promotion does not match server calculation",
          });
        }
      }

      const createdOrders = await createOrders(
        String(dailyReferenceNumber),
        ordersArr,
        userId,
        "customer",
        salesInstance._id as Types.ObjectId,
        new Types.ObjectId(businessId as string),
        session
      );

      if (typeof createdOrders === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: createdOrders });
      }

      const createdOrdersIds: Types.ObjectId[] = (createdOrders as IOrder[]).map(
        (order: { _id: Types.ObjectId }) => order._id
      );

      const closeOrdersResult = await closeOrders(
        createdOrdersIds,
        paymentMethodArr,
        session
      );

      if (closeOrdersResult !== true) {
        await session.abortTransaction();
        return reply.code(400).send({ message: closeOrdersResult });
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

      const totalSalesBeforeAdjustments = (createdOrders as IOrder[]).reduce(
        (acc: number, order: { orderGrossPrice?: number }) =>
          acc + (order.orderGrossPrice ?? 0),
        0
      );

      const totalNetPaidAmount = (createdOrders as IOrder[]).reduce(
        (acc: number, order: { orderNetPrice: number }) =>
          acc + order.orderNetPrice,
        0
      );

      const totalCostOfGoodsSold = (createdOrders as IOrder[]).reduce(
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
        return reply.code(400).send({ message: "Update dailySalesReport failed!" });
      }

      await session.commitTransaction();

      const businessIdObjectId = new Types.ObjectId(businessId as string);
      checkLowStockAndNotify(businessIdObjectId).catch(() => {});
      sendOrderConfirmation(userId, businessIdObjectId, {
        dailyReferenceNumber,
        totalNetPaidAmount,
        orderCount: (createdOrders as IOrder[]).length,
      }).catch(() => {});

      return reply.code(201).send({ message: "Customer self ordering created" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Create salesInstance failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });
};

