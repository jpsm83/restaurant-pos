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
import { Types } from "mongoose";
import type { ISalesPoint } from "domain/interfaces/ISalesPoint";

import SalesPoint from "../../models/salesPoint.ts";
import generateQrCode from "../../salesPoints/generateQrCode.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import {
  conflict,
  internal,
  notFound,
} from "../../errors/appError.ts";
import {
  createSalesPointBodySchema,
  salesPointIdParamsSchema,
  updateSalesPointBodySchema,
  type CreateSalesPointBody,
  type SalesPointIdParams,
  type UpdateSalesPointBody,
} from "domain/schemas/salesPoints";

export const salesPointsRoutes: FastifyPluginAsync = async (app) => {
  // GET /salesPoints - list all
  app.get("/", async (_req, reply) => {
    const salesPoints = await SalesPoint.find().lean();

    if (!salesPoints.length) {
      throw notFound("No salesPoints found!");
    }
    return reply.code(200).send(salesPoints);
  });

  // POST /salesPoints - create
  app.post<{ Body: CreateSalesPointBody }>(
    "/",
    { schema: { body: createSalesPointBodySchema } },
    async (req, reply) => {
      const { salesPointName, salesPointType, selfOrdering, businessId } =
        req.body;
      const businessObjectId = new Types.ObjectId(businessId);

      if (salesPointType === "delivery") {
        const existingDelivery = await SalesPoint.exists({
          businessId: businessObjectId,
          salesPointType: "delivery",
        });
        if (existingDelivery) {
          throw conflict("This business already has a delivery sales point.");
        }
      }

      const duplicateSalesPoint = await SalesPoint.exists({
        businessId: businessObjectId,
        salesPointName,
      });

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
          await SalesPoint.deleteOne({ _id: salesPointCreated._id });
          throw internal("Failed to generate QR code, rollback applied");
        }
        await SalesPoint.updateOne(
          { _id: salesPointCreated._id },
          { $set: { qrCode } },
        );
      }

      return reply.code(201).send({ message: "Sales Point created" });
    },
  );

  // GET /salesPoints/:salesPointId - get by ID
  app.get<{ Params: SalesPointIdParams }>(
    "/:salesPointId",
    { schema: { params: salesPointIdParamsSchema } },
    async (req, reply) => {
      const { salesPointId } = req.params;

      const salesPoint = await SalesPoint.findById(salesPointId).lean();

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

      const salesPoint = await SalesPoint.findById(salesPointId);

      if (!salesPoint) {
        throw notFound("SalesPoint not found!");
      }

      if (salesPointName) {
        const duplicateSalesPoint = await SalesPoint.exists({
          salesPointName,
          _id: { $ne: salesPointId },
          businessId: salesPoint.businessId,
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
        { _id: salesPointId },
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
    { schema: { params: salesPointIdParamsSchema } },
    async (req, reply) => {
      const { salesPointId } = req.params;

      const salesPoint = await SalesPoint.findById(salesPointId);

      if (!salesPoint) {
        throw notFound("SalesPoint not found!");
      }

      const qrCode = salesPoint.qrCode;

      const result = await SalesPoint.deleteOne({
        _id: salesPointId,
      });

      if (result.deletedCount === 0) {
        throw notFound("Sales location not found or it has orders!");
      }

      if (qrCode) {
        const deleteResult = await deleteFilesCloudinary(qrCode);

        if (deleteResult !== true) {
          throw internal(String(deleteResult));
        }
      }

      return reply.code(200).send({
        message: "Sales point deleted successfully",
      });
    },
  );
};
