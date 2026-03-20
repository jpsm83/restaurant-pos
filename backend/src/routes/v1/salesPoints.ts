import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import type { ISalesPoint } from "@shared/interfaces/ISalesPoint";

import { isObjectIdValid } from "../../utils/isObjectIdValid.ts";
import SalesPoint from "../../models/salesPoint.ts";
import { generateQrCode } from "../../salesPoints/generateQrCode.ts";
import { deleteFilesCloudinary } from "../../cloudinary/deleteFilesCloudinary.ts";
import { salesPointTypeEnums } from "../../../../lib/enums.ts";

export const salesPointsRoutes: FastifyPluginAsync = async (app) => {
  // GET /salesPoints - list all
  app.get("/", async (_req, reply) => {
    const salesPoints = await SalesPoint.find().lean();

    if (!salesPoints.length) {
      return reply.code(400).send({ message: "No salesPoints found!" });
    }
    return reply.code(200).send(salesPoints);
  });

  // POST /salesPoints - create
  app.post("/", async (req, reply) => {
    try {
      const body = req.body as ISalesPoint;
      const { salesPointName, salesPointType, selfOrdering, qrEnabled, businessId } =
        body ?? {};

      if (!salesPointName || !businessId) {
        return reply.code(400).send({
          message: "SalesPointName and businessId are required!",
        });
      }

      if (isObjectIdValid([businessId as unknown as string]) !== true) {
        return reply.code(400).send({ message: "Invalid businessId!" });
      }

      if (
        salesPointType !== undefined &&
        salesPointType !== "" &&
        !(salesPointTypeEnums as readonly string[]).includes(salesPointType.toLowerCase())
      ) {
        return reply.code(400).send({
          message: `salesPointType must be one of: ${salesPointTypeEnums.join(", ")}`,
        });
      }

      if (salesPointType?.toLowerCase() === "delivery") {
        const existingDelivery = await SalesPoint.exists({
          businessId,
          salesPointType: "delivery",
        });
        if (existingDelivery) {
          return reply.code(400).send({
            message: "This business already has a delivery sales point.",
          });
        }
      }

      const duplicateSalesPoint = await SalesPoint.exists({
        businessId,
        salesPointName,
      });

      if (duplicateSalesPoint) {
        return reply.code(400).send({
          message: "SalesPoint already exists!",
        });
      }

      const normalizedType = salesPointType
        ? salesPointType.toLowerCase()
        : undefined;

      const newSalesPoint = {
        salesPointName,
        salesPointType: normalizedType,
        selfOrdering: selfOrdering !== undefined ? selfOrdering : false,
        qrEnabled: qrEnabled !== undefined ? qrEnabled : true,
        businessId,
      };

      const salesPointCreated = await SalesPoint.create(newSalesPoint);

      const isDelivery = normalizedType === "delivery";

      if (!isDelivery) {
        const qrCode = await generateQrCode(
          businessId as unknown as Types.ObjectId,
          salesPointCreated._id
        );

        if (!qrCode || qrCode.includes("Failed")) {
          await SalesPoint.deleteOne({ _id: salesPointCreated._id });
          return reply.code(500).send({
            message: "Failed to generate QR code, rollback applied",
          });
        }
        await SalesPoint.updateOne(
          { _id: salesPointCreated._id },
          { $set: { qrCode } }
        );
      }

      return reply.code(201).send({ message: "Sales Point created" });
    } catch (error) {
      return reply.code(500).send({
        message: "Sales location creation failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /salesPoints/:salesPointId - get by ID
  app.get("/:salesPointId", async (req, reply) => {
    const params = req.params as { salesPointId?: string };
    const salesPointId = params.salesPointId;

    if (!salesPointId || isObjectIdValid([salesPointId]) !== true) {
      return reply.code(400).send({ message: "Invalid salesPointId!" });
    }

    const salesPoint = await SalesPoint.findById(salesPointId).lean();

    if (!salesPoint) {
      return reply.code(400).send({ message: "No salesPoint found!" });
    }
    return reply.code(200).send(salesPoint);
  });

  // PATCH /salesPoints/:salesPointId - update
  app.patch("/:salesPointId", async (req, reply) => {
    try {
      const params = req.params as { salesPointId?: string };
      const salesPointId = params.salesPointId;

      const body = req.body as ISalesPoint;
      const { salesPointName, salesPointType, selfOrdering, qrEnabled } = body ?? {};

      if (
        salesPointType !== undefined &&
        salesPointType !== "" &&
        !(salesPointTypeEnums as readonly string[]).includes(salesPointType.toLowerCase())
      ) {
        return reply.code(400).send({
          message: `salesPointType must be one of: ${salesPointTypeEnums.join(", ")}`,
        });
      }

      if (!salesPointId || isObjectIdValid([salesPointId]) !== true) {
        return reply.code(400).send({ message: "Invalid salesPointId!" });
      }

      const salesPoint = await SalesPoint.findById(salesPointId);

      if (!salesPoint) {
        return reply.code(404).send({ message: "SalesPoint not found!" });
      }

      const duplicateSalesPoint = await SalesPoint.exists({
        salesPointName,
        _id: { $ne: salesPointId },
        businessId: salesPoint.businessId,
      });

      if (duplicateSalesPoint) {
        return reply.code(400).send({ message: "SalesPointName already exists!" });
      }

      const updatedSalesPoint: Partial<ISalesPoint> = {};

      if (salesPointName) updatedSalesPoint.salesPointName = salesPointName;
      if (salesPointType)
        updatedSalesPoint.salesPointType = salesPointType.toLowerCase();
      if (selfOrdering !== undefined)
        updatedSalesPoint.selfOrdering = selfOrdering;
      if (qrEnabled !== undefined) updatedSalesPoint.qrEnabled = qrEnabled;

      await SalesPoint.updateOne(
        { _id: salesPointId },
        { $set: updatedSalesPoint }
      );

      return reply.code(200).send({
        message: "Sales point updated successfully!",
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Update salesPoint failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /salesPoints/:salesPointId - delete
  app.delete("/:salesPointId", async (req, reply) => {
    try {
      const params = req.params as { salesPointId?: string };
      const salesPointId = params.salesPointId;

      if (!salesPointId || isObjectIdValid([salesPointId]) !== true) {
        return reply.code(400).send({ message: "Invalid salesPointId!" });
      }

      const salesPoint = await SalesPoint.findById(salesPointId);

      if (!salesPoint) {
        return reply.code(404).send({ message: "SalesPoint not found!" });
      }

      const qrCode = salesPoint.qrCode;

      const result = await SalesPoint.deleteOne({
        _id: salesPointId,
      });

      if (result.deletedCount === 0) {
        return reply.code(404).send({
          message: "Sales location not found or it has orders!",
        });
      }

      if (qrCode) {
        const deleteResult = await deleteFilesCloudinary(qrCode);

        if (deleteResult !== true) {
          return reply.code(500).send({ message: deleteResult });
        }
      }

      return reply.code(200).send({
        message: "Sales point deleted successfully",
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Delete business failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};
