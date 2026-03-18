import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { ISupplier } from "@shared/interfaces/ISupplier";
import type { IAddress } from "@shared/interfaces/IAddress";

import { isObjectIdValid } from "../../utils/isObjectIdValid.js";
import Supplier from "../../models/supplier.js";
import SupplierGood from "../../models/supplierGood.js";
import BusinessGood from "../../models/businessGood.js";
import { uploadFilesCloudinary, UploadInputFile } from "../../cloudinary/uploadFilesCloudinary.js";
import { deleteFilesCloudinary } from "../../cloudinary/deleteFilesCloudinary.js";
import { deleteFolderCloudinary } from "../../cloudinary/deleteFolderCloudinary.js";
import objDefaultValidation from "@shared/utils/objDefaultValidation";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];

const nonReqAddressFields = ["region", "additionalDetails", "coordinates"];

export const suppliersRoutes: FastifyPluginAsync = async (app) => {
  // GET /suppliers - list all
  app.get("/", async (_req, reply) => {
    const suppliers = await Supplier.find().lean();

    if (!suppliers.length) {
      return reply.code(404).send({ message: "No suppliers found!" });
    }
    return reply.code(200).send(suppliers);
  });

  // POST /suppliers - create (formData with image)
  app.post("/", async (req, reply) => {
    try {
      const parts = req.parts();
      const fields: Record<string, string> = {};
      let imageFile: UploadInputFile | undefined;

      for await (const part of parts) {
        if (part.type === "file") {
          if (part.filename && part.fieldname === "imageUrl") {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            imageFile = {
              buffer: Buffer.concat(chunks),
              mimeType: part.mimetype,
            };
          }
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      const tradeName = fields.tradeName;
      const legalName = fields.legalName;
      const email = fields.email;
      const phoneNumber = fields.phoneNumber;
      const taxNumber = fields.taxNumber;
      const businessId = fields.businessId;
      const address = fields.address ? JSON.parse(fields.address) : undefined;
      const currentlyInUse = fields.currentlyInUse === "true";
      const contactPerson = fields.contactPerson || undefined;

      if (
        !tradeName ||
        !legalName ||
        !email ||
        !phoneNumber ||
        !taxNumber ||
        currentlyInUse === undefined ||
        !address ||
        !businessId
      ) {
        return reply.code(400).send({
          message:
            "TradeName, legalName, email, phoneNumber, taxNumber, currentlyInUse, address and businessId are required!",
        });
      }

      if (isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Business ID is not valid!" });
      }

      if (!emailRegex.test(email)) {
        return reply.code(400).send({ message: "Invalid email format!" });
      }

      const addressValidationResult = objDefaultValidation(
        address,
        reqAddressFields,
        nonReqAddressFields
      );

      if (addressValidationResult !== true) {
        return reply.code(400).send({ message: addressValidationResult });
      }

      if (
        tradeName === "One Time Purchase" ||
        legalName === "One Time Purchase" ||
        phoneNumber === "One Time Purchase" ||
        taxNumber === "One Time Purchase"
      ) {
        return reply.code(400).send({
          message:
            "TradeName, legalName, phoneNumber and taxNumber cannot be 'One Time Purchase', thas a reserve string!",
        });
      }

      const duplicateSupplier = await Supplier.exists({
        businessId: businessId,
        $or: [{ legalName }, { email }, { taxNumber }],
      });

      if (duplicateSupplier) {
        return reply.code(409).send({
          message: `Supplier ${legalName}, ${email} or ${taxNumber} already exists!`,
        });
      }

      const supplierId = new mongoose.Types.ObjectId();

      const newSupplier: Partial<ISupplier> = {
        _id: supplierId,
        tradeName,
        legalName,
        email,
        phoneNumber,
        taxNumber,
        currentlyInUse,
        businessId: new Types.ObjectId(businessId),
        address,
        contactPerson: contactPerson || undefined,
      };

      if (imageFile) {
        const folder = `/business/${businessId}/suppliers/${supplierId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: [imageFile],
          onlyImages: true,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every((str) => str.includes("https://"))
        ) {
          return reply.code(400).send({
            message: `Error uploading image: ${cloudinaryUploadResponse}`,
          });
        }

        newSupplier.imageUrl = cloudinaryUploadResponse[0];
      }

      await Supplier.create(newSupplier);

      return reply.code(201).send({
        message: `Supplier ${legalName} created successfully!`,
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Create supplier failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /suppliers/:supplierId - get by ID
  app.get("/:supplierId", async (req, reply) => {
    const params = req.params as { supplierId?: string };
    const supplierId = params.supplierId;

    if (!supplierId || isObjectIdValid([supplierId]) !== true) {
      return reply.code(400).send({ message: "Invalid supplier ID!" });
    }

    const supplier = await Supplier.findById(supplierId).lean();

    if (!supplier) {
      return reply.code(404).send({ message: "No suppliers found!" });
    }
    return reply.code(200).send(supplier);
  });

  // PATCH /suppliers/:supplierId - update (formData with image)
  app.patch("/:supplierId", async (req, reply) => {
    try {
      const params = req.params as { supplierId?: string };
      const supplierId = params.supplierId;

      if (!supplierId || isObjectIdValid([supplierId]) !== true) {
        return reply.code(400).send({ message: "Invalid supplier ID!" });
      }

      const parts = req.parts();
      const fields: Record<string, string> = {};
      let imageFile: UploadInputFile | undefined;

      for await (const part of parts) {
        if (part.type === "file") {
          if (part.filename && part.fieldname === "imageUrl") {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            imageFile = {
              buffer: Buffer.concat(chunks),
              mimeType: part.mimetype,
            };
          }
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      const tradeName = fields.tradeName;
      const legalName = fields.legalName;
      const email = fields.email;
      const phoneNumber = fields.phoneNumber;
      const taxNumber = fields.taxNumber;
      const address = fields.address ? JSON.parse(fields.address) : undefined;
      const currentlyInUse = fields.currentlyInUse === "true";
      const contactPerson = fields.contactPerson || undefined;

      if (
        !tradeName ||
        !legalName ||
        !email ||
        !phoneNumber ||
        !taxNumber ||
        currentlyInUse === undefined ||
        !address
      ) {
        return reply.code(400).send({
          message:
            "TradeName, legalName, email, phoneNumber, taxNumber, currentlyInUse, address and businessId are required!",
        });
      }

      if (!emailRegex.test(email)) {
        return reply.code(400).send({ message: "Invalid email format!" });
      }

      const addressValidationResult = objDefaultValidation(
        address,
        reqAddressFields,
        nonReqAddressFields
      );

      if (addressValidationResult !== true) {
        return reply.code(400).send({ message: addressValidationResult });
      }

      const supplier = (await Supplier.findById(supplierId)
        .select("businessId imageUrl address tradeName legalName email phoneNumber taxNumber currentlyInUse contactPerson")
        .lean()) as unknown as ISupplier | null;

      if (!supplier) {
        return reply.code(404).send({ message: "Supplier not found!" });
      }

      const duplicateSupplier = await Supplier.exists({
        _id: { $ne: supplierId },
        businessId: supplier.businessId,
        $or: [{ legalName }, { email }, { taxNumber }],
      });

      if (duplicateSupplier) {
        return reply.code(409).send({
          message: `Supplier legalName, email or taxNumber already exists in the business!`,
        });
      }

      const updateSupplierObj: Partial<ISupplier> = {};

      if (tradeName && supplier.tradeName !== tradeName)
        updateSupplierObj.tradeName = tradeName;
      if (legalName && supplier.legalName !== legalName)
        updateSupplierObj.legalName = legalName;
      if (email && supplier.email !== email) updateSupplierObj.email = email;
      if (phoneNumber && supplier.phoneNumber !== phoneNumber)
        updateSupplierObj.phoneNumber = phoneNumber;
      if (taxNumber && supplier.taxNumber !== taxNumber)
        updateSupplierObj.taxNumber = taxNumber;
      if (currentlyInUse && supplier.currentlyInUse !== currentlyInUse)
        updateSupplierObj.currentlyInUse = currentlyInUse;
      if (contactPerson && supplier.contactPerson !== contactPerson)
        updateSupplierObj.contactPerson = contactPerson;

      const updatedAddress: Partial<IAddress> = {};

      for (const [key, value] of Object.entries(address)) {
        if (value !== supplier.address?.[key as keyof typeof address]) {
          (updatedAddress as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(updatedAddress).length > 0)
        updateSupplierObj.address = updatedAddress as IAddress;

      if (imageFile) {
        const folder = `/business/${supplier.businessId}/suppliers/${supplierId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: [imageFile],
          onlyImages: true,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every((str) => str.includes("https://"))
        ) {
          return reply.code(400).send({
            message: `Error uploading image: ${cloudinaryUploadResponse}`,
          });
        }

        const deleteFilesCloudinaryResult: string | boolean =
          await deleteFilesCloudinary(supplier?.imageUrl || "");

        if (deleteFilesCloudinaryResult !== true) {
          return reply.code(400).send({ message: deleteFilesCloudinaryResult });
        }

        updateSupplierObj.imageUrl = cloudinaryUploadResponse[0];
      }

      const updatedSupplier = await Supplier.findByIdAndUpdate(
        supplierId,
        { $set: updateSupplierObj },
        { new: true, lean: true }
      );

      if (!updatedSupplier) {
        return reply.code(404).send({ message: "Business to update not found!" });
      }

      return reply.code(200).send({
        message: "Supplier updated successfully!",
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Update supplier failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /suppliers/:supplierId - delete
  app.delete("/:supplierId", async (req, reply) => {
    try {
      const params = req.params as { supplierId?: string };
      const supplierId = params.supplierId;

      if (!supplierId || isObjectIdValid([supplierId]) !== true) {
        return reply.code(400).send({ message: "Invalid supplier ID!" });
      }

      const supplierGoodIds = await SupplierGood.find({
        supplierId: supplierId,
      }).distinct("_id");

      if (supplierGoodIds.length > 0) {
        const isInUse = await BusinessGood.exists({
          "ingredients.supplierGoodId": { $in: supplierGoodIds },
        });

        if (isInUse) {
          return reply.code(409).send({
            message: "Supplier is in use in some business goods!",
          });
        }
      }

      const deletedSupplier = await Supplier.findOneAndDelete({
        _id: supplierId,
      });

      if (!deletedSupplier) {
        return reply.code(404).send({ message: "Business good not found!" });
      }

      const folderPath = `/business/${deletedSupplier?.businessId}/suppliers/${supplierId}`;

      const deleteFolderCloudinaryResult: string | boolean =
        await deleteFolderCloudinary(folderPath);

      if (deleteFolderCloudinaryResult !== true) {
        return reply.code(400).send({ message: deleteFolderCloudinaryResult });
      }

      return reply.code(200).send({
        message: `Supplier deleted successfully!`,
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Delete supplier failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /suppliers/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid business ID!" });
    }

    const suppliers = await Supplier.find({ businessId }).lean();

    if (!suppliers.length) {
      return reply.code(404).send({ message: "No suppliers found!" });
    }
    return reply.code(200).send(suppliers);
  });
};
