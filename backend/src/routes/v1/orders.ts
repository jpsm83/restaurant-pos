/**
 * Orders Routes - Order CRUD and listing.
 *
 * Every route declares its body/params as a strict zod DTO from
 * `packages/schemas/orders.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. `ordersArrValidation` and the
 * price-tolerance check stay as named post-parse checks.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IOrder } from "../../../../packages/interfaces/IOrder.ts";
import Order from "../../models/order.ts";
import SalesInstance from "../../models/salesInstance.ts";
import User from "../../models/user.ts";
import BusinessGood from "../../models/businessGood.ts";
import SalesPoint from "../../models/salesPoint.ts";
import Employee from "../../models/employee.ts";
import ordersArrValidation from "../../orders/ordersArrValidation.ts";
import createOrders from "../../orders/createOrders.ts";
import cancelOrders from "../../orders/cancelOrders.ts";
import applyPromotionsToOrders from "../../promotions/applyPromotions.ts";
import { createAuthHook } from "../../auth/middleware.ts";
import {
  badRequest,
  forbidden,
  notFound,
  unauthorized,
} from "../../errors/appError.ts";
import {
  createOrderBodySchema,
  orderIdParamsSchema,
  ordersBySalesInstanceParamsSchema,
  ordersByUserParamsSchema,
  type CreateOrderBody,
  type OrderIdParams,
  type OrdersBySalesInstanceParams,
  type OrdersByUserParams,
} from "../../../../packages/schemas/orders.ts";
import * as enums from "../../../../packages/enums.ts";

const { managementRolesEnums } = enums;

const ORDER_POPULATE = [
  {
    path: "salesInstanceId",
    select: "salesPointId",
    populate: {
      path: "salesPointId",
      select: "salesPointName",
      model: SalesPoint,
    },
    model: SalesInstance,
  },
  {
    path: "createdByUserId",
    select: "personalDetails.firstName personalDetails.lastName",
    model: User,
  },
  {
    path: "businessGoodId",
    select:
      "name mainCategory subCategory productionTime sellingPrice allergens",
    model: BusinessGood,
  },
  {
    path: "addOns",
    select:
      "name mainCategory subCategory productionTime sellingPrice allergens",
    model: BusinessGood,
  },
];

export const ordersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_req, reply) => {
    const orders = await Order.find().populate(ORDER_POPULATE).lean();

    if (!orders.length) {
      throw notFound("No orders found!");
    }

    return reply.code(200).send(orders);
  });

  app.post<{ Body: CreateOrderBody }>(
    "/",
    {
      preValidation: [createAuthHook(app)],
      schema: { body: createOrderBodySchema },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }
      const createdByUserId = new Types.ObjectId(req.authSession.id);

      const { ordersArr, salesInstanceId, businessId, dailyReferenceNumber } =
        req.body;

      const preparedOrders: Partial<IOrder>[] = ordersArr.map((order) => ({
        orderGrossPrice: order.orderGrossPrice,
        orderNetPrice: order.orderNetPrice,
        orderCostPrice: order.orderCostPrice,
        businessGoodId: new Types.ObjectId(order.businessGoodId),
        addOns: order.addOns?.map((addOnId) => new Types.ObjectId(addOnId)),
        allergens: order.allergens,
        promotionApplyed: order.promotionApplyed,
        comments: order.comments,
      }));

      const validation = ordersArrValidation(preparedOrders);
      if (validation !== true) {
        throw badRequest(validation);
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const pricedOrders = await applyPromotionsToOrders({
          businessId: new Types.ObjectId(businessId),
          ordersArr: preparedOrders,
          flow: "seated",
          session,
        });
        if (typeof pricedOrders === "string") {
          throw badRequest(pricedOrders);
        }

        const PRICE_TOLERANCE = 0.01;
        for (let i = 0; i < pricedOrders.length; i++) {
          const backend = pricedOrders[i];
          const client = ordersArr[i] as {
            orderNetPrice?: number;
            promotionApplyed?: string;
            discountPercentage?: number;
          };
          if (
            Math.abs(
              (client.orderNetPrice ?? 0) - (backend.orderNetPrice ?? 0),
            ) > PRICE_TOLERANCE ||
            (client.promotionApplyed !== undefined &&
              backend.promotionApplyed !== undefined &&
              client.promotionApplyed !== backend.promotionApplyed) ||
            (client.promotionApplyed === undefined &&
              backend.promotionApplyed !== undefined) ||
            (client.promotionApplyed !== undefined &&
              backend.promotionApplyed === undefined) ||
            Math.abs(
              (client.discountPercentage ?? 0) -
                (backend.discountPercentage ?? 0),
            ) > PRICE_TOLERANCE
          ) {
            throw badRequest(
              "Order price or promotion does not match server calculation",
            );
          }
        }

        const created = await createOrders(
          String(dailyReferenceNumber),
          preparedOrders,
          createdByUserId,
          "employee",
          new Types.ObjectId(salesInstanceId),
          new Types.ObjectId(businessId),
          session,
        );

        if (typeof created === "string") {
          throw badRequest(created);
        }

        await session.commitTransaction();
        return reply.code(201).send({ message: "Order created" });
      } catch (e) {
        await session.abortTransaction();
        throw e;
      } finally {
        session.endSession();
      }
    },
  );

  app.get<{ Params: OrderIdParams }>(
    "/:orderId",
    { schema: { params: orderIdParamsSchema } },
    async (req, reply) => {
      const { orderId } = req.params;

      const order = await Order.findById(orderId)
        .populate(ORDER_POPULATE)
        .lean();

      if (!order) {
        throw notFound("Order not found!");
      }

      return reply.code(200).send(order);
    },
  );

  app.delete<{ Params: OrderIdParams }>(
    "/:orderId",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: orderIdParamsSchema },
    },
    async (req, reply) => {
      const { orderId } = req.params;

      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized(
          "Unauthorized; userId from session is required to cancel orders!",
        );
      }
      const sessionUserId = new Types.ObjectId(req.authSession.id);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const orderDoc = (await Order.findById(orderId)
          .select("businessId salesInstanceId")
          .session(session)
          .lean()) as {
          businessId: Types.ObjectId;
          salesInstanceId: Types.ObjectId;
        } | null;

        if (!orderDoc) {
          throw notFound("Order not found!");
        }

        const businessId =
          typeof orderDoc.businessId === "object" &&
          orderDoc.businessId !== null &&
          "_id" in orderDoc.businessId
            ? (orderDoc.businessId as { _id: Types.ObjectId })._id
            : (orderDoc.businessId as Types.ObjectId);

        const salesInstanceId = orderDoc.salesInstanceId;

        const employee = (await Employee.findOne({
          userId: sessionUserId,
          businessId,
        })
          .select("allEmployeeRoles")
          .session(session)
          .lean()) as { allEmployeeRoles?: string[] } | null;

        if (
          !employee ||
          !managementRolesEnums.some((role) =>
            employee.allEmployeeRoles?.includes(role),
          )
        ) {
          throw forbidden("Only management roles can cancel orders!");
        }

        const cancelOrdersResult = await cancelOrders(
          [new Types.ObjectId(orderId)],
          salesInstanceId,
          session,
        );

        if (cancelOrdersResult !== true) {
          throw badRequest(cancelOrdersResult);
        }

        await session.commitTransaction();

        return reply.code(200).send({ message: "Order deleted successfully!" });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  app.get<{ Params: OrdersBySalesInstanceParams }>(
    "/salesInstance/:salesInstanceId",
    { schema: { params: ordersBySalesInstanceParamsSchema } },
    async (req, reply) => {
      const { salesInstanceId } = req.params;

      const orders = await Order.find({ salesInstanceId })
        .populate(ORDER_POPULATE)
        .lean();

      if (!orders.length) {
        throw notFound("No orders found!");
      }

      return reply.code(200).send(orders);
    },
  );

  app.get<{ Params: OrdersByUserParams }>(
    "/user/:userId",
    { schema: { params: ordersByUserParamsSchema } },
    async (req, reply) => {
      const { userId } = req.params;

      const orders = await Order.find({ createdByUserId: userId })
        .populate(ORDER_POPULATE)
        .lean();

      if (!orders.length) {
        throw notFound("No orders found!");
      }

      return reply.code(200).send(orders);
    },
  );
};
