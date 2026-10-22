/**
 * SalesPoints Routes - Sales point CRUD and listing.
 *
 * Every route declares its body/params as a strict zod DTO from
 * `packages/schemas/salesPoints.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. The delivery-uniqueness and
 * duplicate-name rules stay as named post-parse checks.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { ISalesPoint } from "restaurant-pos-packages/interfaces/ISalesPoint";

import SalesPoint from "../../models/salesPoint.ts";
import { createOptionalAuthHook } from "../../auth/middleware.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import generateQrCode from "../../salesPoints/generateQrCode.ts";
import {
  conflict,
  internal,
  notFound,
} from "../../errors/appError.ts";
import {
  createSalesPointBodySchema,
  salesPointIdParamsSchema,
  salesPointsIncludeDeletedQuerySchema,
  updateSalesPointBodySchema,
  type CreateSalesPointBody,
  type SalesPointIdParams,
  type SalesPointsIncludeDeletedQuery,
  type UpdateSalesPointBody,
} from "restaurant-pos-packages/schemas/salesPoints";

export const salesPointsRoutes: FastifyPluginAsync = async (app) => {
  // GET /salesPoints - list all
  app.get<{ Querystring: SalesPointsIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: salesPointsIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const salesPoints = await SalesPoint.find(
        withSoftDeleteFilter({}, includeDeleted),
      ).lean();

      if (!salesPoints.length) {
        throw notFound("No salesPoints found!");
      }
      return reply.code(200).send(salesPoints);
    },
  );

  // POST /salesPoints - create
  app.post<{ Body: CreateSalesPointBody }>(
    "/",
    { schema: { body: createSalesPointBodySchema } },
    async (req, reply) => {
      const { salesPointName, salesPointType, selfOrdering, businessId } =
        req.body;
      const businessObjectId = new Types.ObjectId(businessId);

      if (salesPointType === "delivery") {
        const existingDelivery = await SalesPoint.exists(
          withSoftDeleteFilter({
            businessId: businessObjectId,
            salesPointType: "delivery",
          }),
        );
        if (existingDelivery) {
          throw conflict("This business already has a delivery sales point.");
        }
      }

      const duplicateSalesPoint = await SalesPoint.exists(
        withSoftDeleteFilter({
          businessId: businessObjectId,
          salesPointName,
        }),
      );

      if (duplicateSalesPoint) {
        throw conflict("SalesPoint already exists!");
      }

      const salesPointCreated = await SalesPoint.create({
        salesPointName,
        salesPointType,
        selfOrdering: selfOrdering ?? false,
        businessId: businessObjectId,
      });

      if (salesPointType !== "delivery") {
        const qrCode = await generateQrCode(
          businessObjectId,
          salesPointCreated._id,
        );

        if (!qrCode || qrCode.includes("Failed")) {
          await markAsDeletedById(
            SalesPoint as mongoose.Model<ISalesPoint & { deleted: boolean }>,
            String(salesPointCreated._id),
          );
          throw internal("Failed to generate QR code, rollback applied");
        }
        await SalesPoint.updateOne(
          withSoftDeleteFilter({ _id: salesPointCreated._id }),
          { $set: { qrCode } },
        );
      }

      return reply.code(201).send({ message: "Sales Point created" });
    },
  );

  // GET /salesPoints/:salesPointId - get by ID
  app.get<{
    Params: SalesPointIdParams;
    Querystring: SalesPointsIncludeDeletedQuery;
  }>(
    "/:salesPointId",
    {
      schema: {
        params: salesPointIdParamsSchema,
        querystring: salesPointsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { salesPointId } = req.params;
      const { includeDeleted = false } = req.query;

      const salesPoint = await SalesPoint.findOne(
        withSoftDeleteFilter({ _id: salesPointId }, includeDeleted),
      ).lean();

      if (!salesPoint) {
        throw notFound("No salesPoint found!");
      }
      return reply.code(200).send(salesPoint);
    },
  );

  // PATCH /salesPoints/:salesPointId - update
  app.patch<{ Params: SalesPointIdParams; Body: UpdateSalesPointBody }>(
    "/:salesPointId",
    {
      schema: {
        params: salesPointIdParamsSchema,
        body: updateSalesPointBodySchema,
      },
    },
    async (req, reply) => {
      const { salesPointId } = req.params;
      const { salesPointName, salesPointType, selfOrdering } = req.body;

      const salesPoint = await SalesPoint.findOne(
        withSoftDeleteFilter({ _id: salesPointId }),
      );

      if (!salesPoint) {
        throw notFound("SalesPoint not found!");
      }

      if (salesPointName) {
        const duplicateSalesPoint = await SalesPoint.exists({
          ...withSoftDeleteFilter({
            salesPointName,
            _id: { $ne: salesPointId },
            businessId: salesPoint.businessId,
          }),
        });

        if (duplicateSalesPoint) {
          throw conflict("SalesPointName already exists!");
        }
      }

      const updatedSalesPoint: Partial<ISalesPoint> = {};

      if (salesPointName) updatedSalesPoint.salesPointName = salesPointName;
      if (salesPointType) updatedSalesPoint.salesPointType = salesPointType;
      if (selfOrdering !== undefined)
        updatedSalesPoint.selfOrdering = selfOrdering;

      await SalesPoint.updateOne(
        withSoftDeleteFilter({ _id: salesPointId }),
        { $set: updatedSalesPoint },
      );

      return reply.code(200).send({
        message: "Sales point updated successfully!",
      });
    },
  );

  // DELETE /salesPoints/:salesPointId - delete
  app.delete<{ Params: SalesPointIdParams }>(
    "/:salesPointId",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: { params: salesPointIdParamsSchema },
    },
    async (req, reply) => {
      const { salesPointId } = req.params;

      const salesPoint = await SalesPoint.findById(salesPointId).setOptions({
        includeDeleted: true,
      });

      if (!salesPoint) {
        throw notFound("SalesPoint not found!");
      }
      if (salesPoint.deleted) {
        throw conflict("SalesPoint already deleted!");
      }

      const wasDeleted = await markAsDeletedById(
        SalesPoint as mongoose.Model<ISalesPoint & { deleted: boolean }>,
        salesPointId,
        { deletedBy: req.authSession?.id },
      );

      if (!wasDeleted) {
        throw conflict("SalesPoint already deleted!");
      }

      return reply.code(200).send({
        message: "Sales point deleted successfully",
      });
    },
  );
};
