import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import Order from "../../models/order.ts";
import SalesInstance from "../../models/salesInstance.ts";
import User from "../../models/user.ts";
import BusinessGood from "../../models/businessGood.ts";
import SalesPoint from "../../models/salesPoint.ts";
import Employee from "../../models/employee.ts";
import { isObjectIdValid } from "../../utils/isObjectIdValid.ts";
import { managementRolesEnums } from "../../../lib/enums.ts";
import { ordersArrValidation } from "../../orders/ordersArrValidation.ts";
import { createOrders } from "../../orders/createOrders.ts";
import { cancelOrders } from "../../orders/cancelOrders.ts";
import { applyPromotionsToOrders } from "../../promotions/applyPromotions.ts";
import { createAuthHook } from "../../auth/middleware.ts";

export const ordersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_req, reply) => {
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
        path: "createdByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "businessGoodId",
        select: "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .populate({
        path: "addOns",
        select: "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .lean();

    if (!orders.length) {
      return reply.code(404).send({ message: "No orders found!" });
    }

    return reply.code(200).send(orders);
  });

  app.post("/", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const createdByUserId = new Types.ObjectId(req.authSession.id);

    const body = req.body as {
      ordersArr: Record<string, unknown>[];
      salesInstanceId: string;
      businessId: string;
      dailyReferenceNumber: string;
    };

    const { ordersArr, salesInstanceId, businessId, dailyReferenceNumber } = body ?? ({} as typeof body);

    if (!ordersArr || !salesInstanceId || !businessId || !dailyReferenceNumber) {
      return reply.code(400).send({
        message:
          "OrdersArr, dailyReferenceNumber, salesInstanceId and businessId are required fields!",
      });
    }

    const objectIds: Types.ObjectId[] = (ordersArr as Array<{ businessGoodId?: Types.ObjectId; addOns?: Types.ObjectId[] }>).flatMap(
      (order) => [order.businessGoodId!, ...(order.addOns ?? [])]
    );
    objectIds.push(new Types.ObjectId(businessId), new Types.ObjectId(salesInstanceId));

    if (isObjectIdValid(objectIds) !== true) {
      return reply.code(400).send({
        message: "businessGoodId, addOns, businessId or salesInstanceId not valid!",
      });
    }

    const validation = ordersArrValidation(ordersArr as any);
    if (validation !== true) {
      return reply.code(400).send({ message: validation });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const pricedOrders = await applyPromotionsToOrders({
        businessId: new Types.ObjectId(businessId),
        ordersArr: ordersArr as any,
        session,
      });
      if (typeof pricedOrders === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: pricedOrders });
      }

      const PRICE_TOLERANCE = 0.01;
      for (let i = 0; i < pricedOrders.length; i++) {
        const backend = pricedOrders[i];
        const client = ordersArr[i] as any;
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
            (client.discountPercentage ?? 0) -
              (backend.discountPercentage ?? 0)
          ) > PRICE_TOLERANCE
        ) {
          await session.abortTransaction();
          return reply
            .code(400)
            .send({ message: "Order price or promotion does not match server calculation" });
        }
      }

      const created = await createOrders(
        dailyReferenceNumber,
        ordersArr as any,
        createdByUserId,
        "employee",
        new Types.ObjectId(salesInstanceId),
        new Types.ObjectId(businessId),
        session
      );

      if (typeof created === "string") {
        await session.abortTransaction();
        return reply.code(400).send({ message: created });
      }

      await session.commitTransaction();
      return reply.code(201).send({ message: "Order created" });
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  });

  app.get("/:orderId", async (req, reply) => {
    const params = req.params as { orderId?: string };
    const orderId = params.orderId;

    if (!orderId || isObjectIdValid([orderId]) !== true) {
      return reply.code(400).send({ message: "OrderId not valid!" });
    }

    const order = await Order.findById(orderId)
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
        path: "createdByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
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

    if (!order) {
      return reply.code(404).send({ message: "Order not found!" });
    }

    return reply.code(200).send(order);
  });

  app.delete("/:orderId", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    const params = req.params as { orderId?: string };
    const orderId = params.orderId;

    if (!orderId || isObjectIdValid([orderId]) !== true) {
      return reply.code(400).send({ message: "OrderId not valid!" });
    }

    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({
        message: "Unauthorized; userId from session is required to cancel orders!",
      });
    }
    const sessionUserId = new Types.ObjectId(req.authSession.id);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const orderDoc = (await Order.findById(orderId)
        .select("businessId")
        .session(session)
        .lean()) as { businessId: Types.ObjectId } | null;

      if (!orderDoc) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Order not found!" });
      }

      const businessId =
        typeof orderDoc.businessId === "object" &&
        orderDoc.businessId !== null &&
        "_id" in orderDoc.businessId
          ? (orderDoc.businessId as { _id: Types.ObjectId })._id
          : (orderDoc.businessId as Types.ObjectId);

      const employee = (await Employee.findOne({
        userId: sessionUserId,
        businessId,
      })
        .select("allEmployeeRoles")
        .session(session)
        .lean()) as { allEmployeeRoles?: string[] } | null;

      if (!employee || !managementRolesEnums.some((role) => employee.allEmployeeRoles?.includes(role))) {
        await session.abortTransaction();
        return reply.code(403).send({
          message: "Only management roles can cancel orders!",
        });
      }

      const cancelOrdersResult = await cancelOrders(
        [new Types.ObjectId(orderId)],
        session
      );

      if (cancelOrdersResult !== true) {
        await session.abortTransaction();
        return reply.code(400).send({ message: cancelOrdersResult });
      }

      await session.commitTransaction();

      return reply.code(200).send({ message: "Order deleted successfully!" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Delete order failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  app.get("/salesInstance/:salesInstanceId", async (req, reply) => {
    const params = req.params as { salesInstanceId?: string };
    const salesInstanceId = params.salesInstanceId;

    if (!salesInstanceId || isObjectIdValid([salesInstanceId]) !== true) {
      return reply.code(400).send({ message: "SalesInstanceId is not valid!" });
    }

    const orders = await Order.find({ salesInstanceId: salesInstanceId })
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
        path: "createdByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
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

    if (!orders.length) {
      return reply.code(404).send({ message: "No orders found!" });
    }

    return reply.code(200).send(orders);
  });

  app.get("/user/:userId", async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId;

    if (!userId || isObjectIdValid([userId]) !== true) {
      return reply.code(400).send({ message: "Invalid userId" });
    }

    const orders = await Order.find({ createdByUserId: userId })
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
        path: "createdByUserId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
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

    if (!orders.length) {
      return reply.code(404).send({ message: "No orders found!" });
    }

    return reply.code(200).send(orders);
  });
};

