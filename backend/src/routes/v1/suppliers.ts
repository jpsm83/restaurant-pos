/**
 * Suppliers Routes — supplier CRUD and per-business listing.
 *
 * Multipart bodies (create and update) are buffered and validated by the shared
 * multipart helper against strict zod DTOs from
 * `packages/schemas/supplier.ts`; the JSON-encoded `address` field is parsed and
 * validated there and `email` is normalized. The GET/PATCH/DELETE path params
 * are validated by their DTOs. The reserved "One Time Purchase" rule and the
 * database-dependent in-use delete guard stay here as named post-parse checks.
 * Every error is raised as an `AppError` so the global handler emits RFC 9457
 * `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { ISupplier } from "../../../../packages/interfaces/ISupplier.ts";
import type { IAddress } from "../../../../packages/interfaces/IAddress.ts";

import Supplier from "../../models/supplier.ts";
import SupplierGood from "../../models/supplierGood.ts";
import BusinessGood from "../../models/businessGood.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import deleteFolderCloudinary from "../../cloudinary/deleteFolderCloudinary.ts";
import { badRequest, conflict, notFound } from "../../errors/appError.ts";
import { parseMultipart } from "../../schemas/multipart.ts";
import {
  createSupplierBodySchema,
  supplierByBusinessParamsSchema,
  supplierIdParamsSchema,
  updateSupplierBodySchema,
  type CreateSupplierBody,
  type SupplierByBusinessParams,
  type SupplierIdParams,
} from "../../../../packages/schemas/supplier.ts";

/** The supplier identity fields the reserved-name rule applies to. */
type SupplierIdentityFields = Pick<
  CreateSupplierBody,
  "tradeName" | "legalName" | "phoneNumber" | "taxNumber"
>;

/** The sentinel used by ad-hoc purchases; no real supplier may take this name. */
const RESERVED_SUPPLIER_NAME = "One Time Purchase";

/**
 * The reserved-name rule: the supplier identity fields may not be the sentinel
 * "One Time Purchase" used for ad-hoc purchases. Post-parse because it spans
 * several fields.
 */
function assertNotReservedName(fields: SupplierIdentityFields): void {
  const names = [
    fields.tradeName,
    fields.legalName,
    fields.phoneNumber,
    fields.taxNumber,
  ];
  if (names.includes(RESERVED_SUPPLIER_NAME)) {
    throw badRequest(
      "TradeName, legalName, phoneNumber and taxNumber cannot be 'One Time Purchase', thas a reserve string!",
    );
  }
}

export const suppliersRoutes: FastifyPluginAsync = async (app) => {
  // GET /suppliers - list all
  app.get("/", async (_req, reply) => {
    const suppliers = await Supplier.find().lean();

    if (!suppliers.length) {
      throw notFound("No suppliers found!");
    }
    return reply.code(200).send(suppliers);
  });

  // POST /suppliers - create (formData with image)
  app.post("/", async (req, reply) => {
    if (typeof req.parts !== "function") {
      throw badRequest("Expected multipart/form-data");
    }

    const { fields, files } = await parseMultipart(
      req,
      createSupplierBodySchema,
    );

    assertNotReservedName(fields);

    const duplicateSupplier = await Supplier.exists({
      businessId: fields.businessId,
      $or: [
        { legalName: fields.legalName },
        { email: fields.email },
        { taxNumber: fields.taxNumber },
      ],
    });

    if (duplicateSupplier) {
      throw conflict(
        `Supplier ${fields.legalName}, ${fields.email} or ${fields.taxNumber} already exists!`,
      );
    }

    const supplierId = new mongoose.Types.ObjectId();

    const newSupplier: Partial<ISupplier> = {
      _id: supplierId,
      tradeName: fields.tradeName,
      legalName: fields.legalName,
      email: fields.email,
      phoneNumber: fields.phoneNumber,
      taxNumber: fields.taxNumber,
      currentlyInUse: fields.currentlyInUse,
      businessId: new Types.ObjectId(fields.businessId),
      address: fields.address as IAddress,
      contactPerson: fields.contactPerson,
    };

    const imageFile = files.find((file) => file.fieldname === "imageUrl");
    if (imageFile && imageFile.buffer.length > 0) {
      const folder = `/business/${fields.businessId}/suppliers/${supplierId}`;

      const cloudinaryUploadResponse = await uploadFilesCloudinary({
        folder,
        filesArr: [
          { buffer: imageFile.buffer, mimeType: imageFile.mimetype },
        ],
        onlyImages: true,
      });

      if (
        typeof cloudinaryUploadResponse === "string" ||
        cloudinaryUploadResponse.length === 0 ||
        !cloudinaryUploadResponse.every((str) => str.includes("https://"))
      ) {
        throw badRequest(`Error uploading image: ${cloudinaryUploadResponse}`);
      }

      newSupplier.imageUrl = cloudinaryUploadResponse[0];
    }

    await Supplier.create(newSupplier);

    return reply.code(201).send({
      message: `Supplier ${fields.legalName} created successfully!`,
    });
  });

  // GET /suppliers/:supplierId - get by ID
  app.get<{ Params: SupplierIdParams }>(
    "/:supplierId",
    { schema: { params: supplierIdParamsSchema } },
    async (req, reply) => {
      const { supplierId } = req.params;

      const supplier = await Supplier.findById(supplierId).lean();

      if (!supplier) {
        throw notFound("No suppliers found!");
      }
      return reply.code(200).send(supplier);
    },
  );

  // PATCH /suppliers/:supplierId - update (formData with image)
  app.patch<{ Params: SupplierIdParams }>(
    "/:supplierId",
    { schema: { params: supplierIdParamsSchema } },
    async (req, reply) => {
      const { supplierId } = req.params;

      if (typeof req.parts !== "function") {
        throw badRequest("Expected multipart/form-data");
      }

      const { fields, files } = await parseMultipart(
        req,
        updateSupplierBodySchema,
      );

      const supplier = (await Supplier.findById(supplierId)
        .select(
          "businessId imageUrl address tradeName legalName email phoneNumber taxNumber currentlyInUse contactPerson",
        )
        .lean()) as unknown as ISupplier | null;

      if (!supplier) {
        throw notFound("Supplier not found!");
      }

      const duplicateSupplier = await Supplier.exists({
        _id: { $ne: supplierId },
        businessId: supplier.businessId,
        $or: [
          { legalName: fields.legalName },
          { email: fields.email },
          { taxNumber: fields.taxNumber },
        ],
      });

      if (duplicateSupplier) {
        throw conflict(
          `Supplier legalName, email or taxNumber already exists in the business!`,
        );
      }

      const updateSupplierObj: Record<string, unknown> = {};

      if (supplier.tradeName !== fields.tradeName)
        updateSupplierObj.tradeName = fields.tradeName;
      if (supplier.legalName !== fields.legalName)
        updateSupplierObj.legalName = fields.legalName;
      if (supplier.email !== fields.email) updateSupplierObj.email = fields.email;
      if (supplier.phoneNumber !== fields.phoneNumber)
        updateSupplierObj.phoneNumber = fields.phoneNumber;
      if (supplier.taxNumber !== fields.taxNumber)
        updateSupplierObj.taxNumber = fields.taxNumber;
      if (supplier.currentlyInUse !== fields.currentlyInUse)
        updateSupplierObj.currentlyInUse = fields.currentlyInUse;
      if (
        fields.contactPerson !== undefined &&
        supplier.contactPerson !== fields.contactPerson
      )
        updateSupplierObj.contactPerson = fields.contactPerson;

      // Dotted `$set` paths preserve address fields not sent in this request.
      for (const [key, value] of Object.entries(fields.address)) {
        if (value !== supplier.address?.[key as keyof IAddress]) {
          updateSupplierObj[`address.${key}`] = value;
        }
      }

      const imageFile = files.find((file) => file.fieldname === "imageUrl");
      if (imageFile && imageFile.buffer.length > 0) {
        const folder = `/business/${supplier.businessId}/suppliers/${supplierId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: [
            { buffer: imageFile.buffer, mimeType: imageFile.mimetype },
          ],
          onlyImages: true,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every((str) => str.includes("https://"))
        ) {
          throw badRequest(`Error uploading image: ${cloudinaryUploadResponse}`);
        }

        const deleteFilesCloudinaryResult: string | boolean =
          await deleteFilesCloudinary(supplier.imageUrl || "");

        if (deleteFilesCloudinaryResult !== true) {
          throw badRequest(
            typeof deleteFilesCloudinaryResult === "string"
              ? deleteFilesCloudinaryResult
              : "DeleteCloudinaryImage failed!",
          );
        }

        updateSupplierObj.imageUrl = cloudinaryUploadResponse[0];
      }

      const updatedSupplier = await Supplier.findByIdAndUpdate(
        supplierId,
        { $set: updateSupplierObj },
        { returnDocument: "after", lean: true },
      );

      if (!updatedSupplier) {
        throw notFound("Supplier to update not found!");
      }

      return reply.code(200).send({
        message: "Supplier updated successfully!",
      });
    },
  );

  // DELETE /suppliers/:supplierId - delete
  app.delete<{ Params: SupplierIdParams }>(
    "/:supplierId",
    { schema: { params: supplierIdParamsSchema } },
    async (req, reply) => {
      const { supplierId } = req.params;

      const supplierGoodIds = await SupplierGood.find({
        supplierId,
      }).distinct("_id");

      if (supplierGoodIds.length > 0) {
        const isInUse = await BusinessGood.exists({
          "ingredients.supplierGoodId": { $in: supplierGoodIds },
        });

        if (isInUse) {
          throw conflict("Supplier is in use in some business goods!");
        }
      }

      const deletedSupplier = await Supplier.findOneAndDelete({
        _id: supplierId,
      });

      if (!deletedSupplier) {
        throw notFound("Supplier not found!");
      }

      const folderPath = `/business/${deletedSupplier.businessId}/suppliers/${supplierId}`;

      const deleteFolderCloudinaryResult: string | boolean =
        await deleteFolderCloudinary(folderPath);

      if (deleteFolderCloudinaryResult !== true) {
        throw badRequest(
          typeof deleteFolderCloudinaryResult === "string"
            ? deleteFolderCloudinaryResult
            : "DeleteCloudinaryFolder failed!",
        );
      }

      return reply.code(200).send({
        message: `Supplier deleted successfully!`,
      });
    },
  );

  // GET /suppliers/business/:businessId - get by business
  app.get<{ Params: SupplierByBusinessParams }>(
    "/business/:businessId",
    { schema: { params: supplierByBusinessParamsSchema } },
    async (req, reply) => {
      const { businessId } = req.params;

      const suppliers = await Supplier.find({ businessId }).lean();

      if (!suppliers.length) {
        throw notFound("No suppliers found!");
      }
      return reply.code(200).send(suppliers);
    },
  );
};
