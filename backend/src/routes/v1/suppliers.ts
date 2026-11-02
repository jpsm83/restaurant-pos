/**
 * Suppliers Routes — supplier reads and per-business listing.
 *
 * The unsafe legacy mutations are retired until the suppliers build-order row
 * lands; every route here still requires a live User session at the v1 gate.
 */
import type { FastifyPluginAsync } from "fastify";

import Supplier from "../../models/supplier.ts";
import { notFound } from "../../errors/appError.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  supplierIncludeDeletedQuerySchema,
  supplierByBusinessParamsSchema,
  supplierIdParamsSchema,
  type SupplierIncludeDeletedQuery,
  type SupplierByBusinessParams,
  type SupplierIdParams,
} from "restaurant-pos-packages/schemas/supplier";

export const suppliersRoutes: FastifyPluginAsync = async (app) => {
  // GET /suppliers - list all
  app.get<{ Querystring: SupplierIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: supplierIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const suppliers = await Supplier.find(
        withSoftDeleteFilter({}, includeDeleted),
      ).lean();

      if (!suppliers.length) {
        throw notFound("No suppliers found!");
      }
      return reply.code(200).send(suppliers);
    },
  );

  // GET /suppliers/:supplierId - get by ID
  app.get<{
    Params: SupplierIdParams;
    Querystring: SupplierIncludeDeletedQuery;
  }>(
    "/:supplierId",
    {
      schema: {
        params: supplierIdParamsSchema,
        querystring: supplierIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { supplierId } = req.params;
      const { includeDeleted = false } = req.query;

      const supplier = await Supplier.findOne(
        withSoftDeleteFilter({ _id: supplierId }, includeDeleted),
      ).lean();

      if (!supplier) {
        throw notFound("No suppliers found!");
      }
      return reply.code(200).send(supplier);
    },
  );

  // GET /suppliers/business/:businessId - get by business
  app.get<{
    Params: SupplierByBusinessParams;
    Querystring: SupplierIncludeDeletedQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: supplierByBusinessParamsSchema,
        querystring: supplierIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      const suppliers = await Supplier.find(
        withSoftDeleteFilter({ businessId }, includeDeleted),
      ).lean();

      if (!suppliers.length) {
        throw notFound("No suppliers found!");
      }
      return reply.code(200).send(suppliers);
    },
  );
};
