/**
 * Orders Routes - Order CRUD and listing.
 *
 * Every route declares its body/params/query as a strict zod DTO from
 * `packages/schemas/orders.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. `ordersArrValidation` and the
 * price-tolerance check stay as named post-parse checks.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import Order from "../../models/order.ts";
import SalesInstance from "../../models/salesInstance.ts";
import User from "../../models/user.ts";
import BusinessGood from "../../models/businessGood.ts";
import SalesPoint from "../../models/salesPoint.ts";
import Employee from "../../models/employee.ts";
import ordersArrValidation from "../../orders/ordersArrValidation.ts";
import createOrders from "../../orders/createOrders.ts";
import cancelOrders from "../../orders/cancelOrders.ts";
import toPreparedOrders from "../../orders/toPreparedOrders.ts";
import orderPriceMatches from "../../orders/orderPriceMatches.ts";
import applyPromotionsToOrders from "../../promotions/applyPromotions.ts";
import { createAuthHook } from "../../auth/middleware.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
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
  ordersIncludeDeletedQuerySchema,
  type CreateOrderBody,
  type OrderIdParams,
  type OrdersBySalesInstanceParams,
  type OrdersByUserParams,
  type OrdersIncludeDeletedQuery,
} from "restaurant-pos-packages/schemas/orders";
import * as enums from "restaurant-pos-packages/enums";

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
  app.get<{ Querystring: OrdersIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: ordersIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const orders = await Order.find(withSoftDeleteFilter({}, includeDeleted))
        .populate(ORDER_POPULATE)
        .lean();

      if (!orders.length) {
        throw notFound("No orders found!");
      }

      return reply.code(200).send(orders);
    },
  );

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

      const preparedOrders = toPreparedOrders(ordersArr);

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

        for (let i = 0; i < pricedOrders.length; i++) {
          if (!orderPriceMatches(preparedOrders[i], pricedOrders[i])) {
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
        await session.abortTransaction().catch(() => undefined);
        throw e;
      } finally {
        session.endSession();
      }
    },
  );

  app.get<{ Params: OrderIdParams; Querystring: OrdersIncludeDeletedQuery }>(
    "/:orderId",
    {
      schema: {
        params: orderIdParamsSchema,
        querystring: ordersIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { orderId } = req.params;
      const { includeDeleted = false } = req.query;

      const order = await Order.findOne(
        withSoftDeleteFilter({ _id: orderId }, includeDeleted),
      )
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
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  app.get<{
    Params: OrdersBySalesInstanceParams;
    Querystring: OrdersIncludeDeletedQuery;
  }>(
    "/salesInstance/:salesInstanceId",
    {
      schema: {
        params: ordersBySalesInstanceParamsSchema,
        querystring: ordersIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { salesInstanceId } = req.params;
      const { includeDeleted = false } = req.query;

      const orders = await Order.find(
        withSoftDeleteFilter({ salesInstanceId }, includeDeleted),
      )
        .populate(ORDER_POPULATE)
        .lean();

      if (!orders.length) {
        throw notFound("No orders found!");
      }

      return reply.code(200).send(orders);
    },
  );

  app.get<{
    Params: OrdersByUserParams;
    Querystring: OrdersIncludeDeletedQuery;
  }>(
    "/user/:userId",
    {
      schema: {
        params: ordersByUserParamsSchema,
        querystring: ordersIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { userId } = req.params;
      const { includeDeleted = false } = req.query;

      const orders = await Order.find(
        withSoftDeleteFilter({ createdByUserId: userId }, includeDeleted),
      )
        .populate(ORDER_POPULATE)
        .lean();

      if (!orders.length) {
        throw notFound("No orders found!");
      }

      return reply.code(200).send(orders);
    },
  );
};
