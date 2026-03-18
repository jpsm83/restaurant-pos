import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { ISupplierGood } from "@shared/interfaces/ISupplierGood";

import { isObjectIdValid } from "../../utils/isObjectIdValid.js";
import SupplierGood from "../../models/supplierGood.js";
import Supplier from "../../models/supplier.js";
import BusinessGood from "../../models/businessGood.js";
import Inventory from "../../models/inventory.js";
import { uploadFilesCloudinary, UploadInputFile } from "../../cloudinary/uploadFilesCloudinary.js";
import { deleteFolderCloudinary } from "../../cloudinary/deleteFolderCloudinary.js";
import { addSupplierGoodToInventory } from "../../inventories/addSupplierGoodToInventory.js";
import { deleteSupplierGoodFromInventory } from "../../inventories/deleteSupplierGoodFromInventory.js";
import { allergensEnums, mainCategoriesEnums } from "../../enums.js";

export const supplierGoodsRoutes: FastifyPluginAsync = async (app) => {
  // GET /supplierGoods - list all
  app.get("/", async (_req, reply) => {
    const supplierGoods = await SupplierGood.find()
      .populate({ path: "supplierId", select: "tradeName", model: Supplier })
      .lean();

    if (!supplierGoods.length) {
      return reply.code(404).send({ message: "No supplier goods found!!" });
    }
    return reply.code(200).send(supplierGoods);
  });

  // POST /supplierGoods - create (formData with image)
  app.post("/", async (req, reply) => {
    try {
      const parts = req.parts();
      const fields: Record<string, string> = {};
      const files: UploadInputFile[] = [];

      for await (const part of parts) {
        if (part.type === "file") {
          if (part.filename) {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            files.push({
              buffer: Buffer.concat(chunks),
              mimeType: part.mimetype,
            });
          }
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      const name = fields.name;
      const keyword = fields.keyword;
      const mainCategory = fields.mainCategory;
      const supplierId = fields.supplierId;
      const businessId = fields.businessId;

      const subCategory = fields.subCategory || undefined;
      const description = fields.description || undefined;
      const allergens = fields.allergens
        ? (JSON.parse(fields.allergens) as string[])
        : [];
      const budgetImpact = fields.budgetImpact || undefined;
      const inventorySchedule = fields.inventorySchedule || undefined;
      const minimumQuantityRequired = fields.minimumQuantityRequired
        ? Number(fields.minimumQuantityRequired)
        : undefined;
      const parLevel = fields.parLevel ? Number(fields.parLevel) : undefined;
      const purchaseUnit = fields.purchaseUnit || undefined;
      const measurementUnit = fields.measurementUnit || undefined;
      const quantityInMeasurementUnit = fields.quantityInMeasurementUnit
        ? Number(fields.quantityInMeasurementUnit)
        : undefined;
      const totalPurchasePrice = fields.totalPurchasePrice
        ? Number(fields.totalPurchasePrice)
        : undefined;

      if (!name || !keyword || !mainCategory || !supplierId || !businessId) {
        return reply.code(400).send({
          message:
            "Name, keyword, mainCategory, supplierId and businessId are required!",
        });
      }

      if (isObjectIdValid([businessId, supplierId]) !== true) {
        return reply.code(400).send({
          message: "Business or supplier ID is not valid!",
        });
      }

      if (files && files.length > 3) {
        return reply.code(400).send({ message: "Max file quantity is 3!" });
      }

      if (!(mainCategoriesEnums as readonly string[]).includes(mainCategory)) {
        return reply.code(400).send({ message: "Invalid main category!" });
      }

      if (allergens.length > 0) {
        for (const allergen of allergens) {
          if (!(allergensEnums as readonly string[]).includes(allergen)) {
            return reply.code(400).send({ message: "Invalid allergen!" });
          }
        }
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const duplicateSupplierGood = await SupplierGood.exists({
          businessId,
          supplierId,
          name,
        });

        if (duplicateSupplierGood) {
          await session.abortTransaction();
          return reply.code(400).send({
            message: `${name} already exists on supplier goods!`,
          });
        }

        const supplierGoodId = new mongoose.Types.ObjectId();

        const newSupplierGoodObj: Partial<ISupplierGood> = {
          _id: supplierGoodId,
          name,
          keyword,
          mainCategory,
          currentlyInUse: true,
          supplierId: new Types.ObjectId(supplierId),
          businessId: new Types.ObjectId(businessId),
          subCategory: subCategory || undefined,
          description: description || undefined,
          allergens: allergens.length > 0 ? allergens : undefined,
          budgetImpact: budgetImpact || undefined,
          inventorySchedule: inventorySchedule || undefined,
          minimumQuantityRequired: minimumQuantityRequired || undefined,
          parLevel: parLevel || undefined,
          purchaseUnit: purchaseUnit || undefined,
          measurementUnit: measurementUnit || undefined,
          quantityInMeasurementUnit: quantityInMeasurementUnit || undefined,
          totalPurchasePrice: totalPurchasePrice || undefined,
          pricePerMeasurementUnit:
            totalPurchasePrice && quantityInMeasurementUnit
              ? totalPurchasePrice / quantityInMeasurementUnit
              : undefined,
        };

        if (files.length > 0) {
          const folder = `/business/${businessId}/suppliersGoods/${supplierGoodId}`;

          const cloudinaryUploadResponse = await uploadFilesCloudinary({
            folder,
            filesArr: files,
            onlyImages: true,
          });

          if (
            typeof cloudinaryUploadResponse === "string" ||
            cloudinaryUploadResponse.length === 0 ||
            !cloudinaryUploadResponse.every((str) => str.includes("https://"))
          ) {
            await session.abortTransaction();
            return reply.code(400).send({
              message: `Error uploading image: ${cloudinaryUploadResponse}`,
            });
          }

          newSupplierGoodObj.imagesUrl = cloudinaryUploadResponse;
        }

        const [newSupplierGood] = await SupplierGood.create(
          [newSupplierGoodObj],
          { session }
        );

        if (!newSupplierGood) {
          await session.abortTransaction();
          return reply.code(400).send({
            message: "Supplier good creation failed!",
          });
        }

        const addSupplierGoodToInventoryResult = await addSupplierGoodToInventory(
          supplierGoodId,
          businessId,
          session
        );

        if (addSupplierGoodToInventoryResult !== true) {
          await session.abortTransaction();
          return reply.code(400).send({
            message:
              "Add supplier good to inventory failed! Error: " +
              addSupplierGoodToInventoryResult,
          });
        }

        await session.commitTransaction();

        return reply.code(201).send({
          message: `Supplier good created successfully!`,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      return reply.code(500).send({
        message: "Create supplier good failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /supplierGoods/:supplierGoodId - get by ID
  app.get("/:supplierGoodId", async (req, reply) => {
    const params = req.params as { supplierGoodId?: string };
    const supplierGoodId = params.supplierGoodId;

    if (!supplierGoodId || isObjectIdValid([supplierGoodId]) !== true) {
      return reply.code(400).send({ message: "Invalid supplierGoodId!" });
    }

    const supplierGood = await SupplierGood.findById(supplierGoodId)
      .populate({ path: "supplierId", select: "tradeName", model: Supplier })
      .lean();

    if (!supplierGood) {
      return reply.code(404).send({ message: "Supplier good not found!" });
    }
    return reply.code(200).send(supplierGood);
  });

  // PATCH /supplierGoods/:supplierGoodId - update (formData with image, transaction)
  app.patch("/:supplierGoodId", async (req, reply) => {
    try {
      const params = req.params as { supplierGoodId?: string };
      const supplierGoodId = params.supplierGoodId;

      if (!supplierGoodId || isObjectIdValid([supplierGoodId]) !== true) {
        return reply.code(400).send({ message: "Invalid supplierGoodId!" });
      }

      const parts = req.parts();
      const fields: Record<string, string> = {};
      const files: UploadInputFile[] = [];

      for await (const part of parts) {
        if (part.type === "file") {
          if (part.filename) {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            files.push({
              buffer: Buffer.concat(chunks),
              mimeType: part.mimetype,
            });
          }
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      const name = fields.name;
      const keyword = fields.keyword;
      const mainCategory = fields.mainCategory;
      const currentlyInUse = fields.currentlyInUse === "true";

      const subCategory = fields.subCategory || undefined;
      const description = fields.description || undefined;
      const allergens = fields.allergens
        ? (JSON.parse(fields.allergens) as string[])
        : [];
      const budgetImpact = fields.budgetImpact || undefined;
      const inventorySchedule = fields.inventorySchedule || undefined;
      const minimumQuantityRequired = fields.minimumQuantityRequired
        ? Number(fields.minimumQuantityRequired)
        : undefined;
      const parLevel = fields.parLevel ? Number(fields.parLevel) : undefined;
      const purchaseUnit = fields.purchaseUnit || undefined;
      const measurementUnit = fields.measurementUnit || undefined;
      const quantityInMeasurementUnit = fields.quantityInMeasurementUnit
        ? Number(fields.quantityInMeasurementUnit)
        : undefined;
      const totalPurchasePrice = fields.totalPurchasePrice
        ? Number(fields.totalPurchasePrice)
        : undefined;

      if (!name || !keyword || !mainCategory) {
        return reply.code(400).send({
          message: "Name, keyword and mainCategory are required!",
        });
      }

      if (!(mainCategoriesEnums as readonly string[]).includes(mainCategory)) {
        return reply.code(400).send({ message: "Invalid main category!" });
      }

      if (allergens.length > 0) {
        for (const allergen of allergens) {
          if (!(allergensEnums as readonly string[]).includes(allergen)) {
            return reply.code(400).send({ message: "Invalid allergen!" });
          }
        }
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const supplierGood = (await SupplierGood.findById(supplierGoodId).lean()) as unknown as ISupplierGood | null;

        if (!supplierGood) {
          await session.abortTransaction();
          return reply.code(404).send({ message: "Supplier good not found!" });
        }

        if (files && files.length + (supplierGood?.imagesUrl?.length || 0) > 3) {
          await session.abortTransaction();
          return reply.code(400).send({ message: "Max file quantity is 3!" });
        }

        const duplicateSupplierGood = await SupplierGood.exists({
          _id: { $ne: supplierGoodId },
          businessId: supplierGood.businessId,
          supplierId: supplierGood.supplierId,
          name,
        });

        if (duplicateSupplierGood) {
          await session.abortTransaction();
          return reply.code(409).send({
            message: `Supplier good ${name} already exists on this supplier!`,
          });
        }

        const updateSupplierGood: Partial<ISupplierGood> = {};

        if (name && name !== supplierGood.name) updateSupplierGood.name = name;
        if (keyword && keyword !== supplierGood.keyword)
          updateSupplierGood.keyword = keyword;
        if (mainCategory && mainCategory !== supplierGood.mainCategory)
          updateSupplierGood.mainCategory = mainCategory;
        if (currentlyInUse !== undefined && currentlyInUse !== supplierGood.currentlyInUse)
          updateSupplierGood.currentlyInUse = currentlyInUse;

        if (subCategory && subCategory !== supplierGood.subCategory)
          updateSupplierGood.subCategory = subCategory;
        if (description && description !== supplierGood.description)
          updateSupplierGood.description = description;
        if (allergens && allergens !== supplierGood.allergens)
          updateSupplierGood.allergens = allergens;
        if (budgetImpact && budgetImpact !== supplierGood.budgetImpact)
          updateSupplierGood.budgetImpact = budgetImpact;
        if (inventorySchedule && inventorySchedule !== supplierGood.inventorySchedule)
          updateSupplierGood.inventorySchedule = inventorySchedule;
        if (minimumQuantityRequired && minimumQuantityRequired !== supplierGood.minimumQuantityRequired)
          updateSupplierGood.minimumQuantityRequired = minimumQuantityRequired;
        if (parLevel && parLevel !== supplierGood.parLevel)
          updateSupplierGood.parLevel = parLevel;
        if (purchaseUnit && purchaseUnit !== supplierGood.purchaseUnit)
          updateSupplierGood.purchaseUnit = purchaseUnit;
        if (measurementUnit && measurementUnit !== supplierGood.measurementUnit)
          updateSupplierGood.measurementUnit = measurementUnit;
        if (quantityInMeasurementUnit && quantityInMeasurementUnit !== supplierGood.quantityInMeasurementUnit)
          updateSupplierGood.quantityInMeasurementUnit = quantityInMeasurementUnit;
        if (totalPurchasePrice && totalPurchasePrice !== supplierGood.totalPurchasePrice)
          updateSupplierGood.totalPurchasePrice = totalPurchasePrice;

        if (updateSupplierGood.totalPurchasePrice && updateSupplierGood.quantityInMeasurementUnit)
          updateSupplierGood.pricePerMeasurementUnit =
            (totalPurchasePrice ?? 0) / (quantityInMeasurementUnit ?? 0);

        if (files.length > 0) {
          const folder = `/business/${supplierGood.businessId}/suppliersGoods/${supplierGoodId}`;

          const cloudinaryUploadResponse = await uploadFilesCloudinary({
            folder,
            filesArr: files,
            onlyImages: true,
          });

          if (
            typeof cloudinaryUploadResponse === "string" ||
            cloudinaryUploadResponse.length === 0 ||
            !cloudinaryUploadResponse.every((str) => str.includes("https://"))
          ) {
            await session.abortTransaction();
            return reply.code(400).send({
              message: `Error uploading image: ${cloudinaryUploadResponse}`,
            });
          }

          updateSupplierGood.imagesUrl = [
            ...(supplierGood?.imagesUrl || []),
            ...cloudinaryUploadResponse,
          ];
        }

        const updatedSupplierGood = await SupplierGood.findByIdAndUpdate(
          supplierGoodId,
          { $set: updateSupplierGood },
          { new: true, lean: true, session }
        );

        if (!updatedSupplierGood) {
          await session.abortTransaction();
          return reply.code(404).send({ message: "Supplier good not updated!" });
        }

        const startOfCurrentMonth = new Date();
        startOfCurrentMonth.setDate(1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);

        const endOfCurrentMonth = new Date(startOfCurrentMonth);
        endOfCurrentMonth.setMonth(endOfCurrentMonth.getMonth() + 1);
        endOfCurrentMonth.setMilliseconds(-1);

        const isSupplierGoodInInventory = await Inventory.exists({
          businessId: supplierGood.businessId,
          setFinalCount: false,
          createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
          "inventoryGoods.supplierGoodId": supplierGoodId,
        });

        if (currentlyInUse === true) {
          if (!isSupplierGoodInInventory) {
            const addSupplierGoodToInventoryResult =
              await addSupplierGoodToInventory(
                supplierGoodId,
                supplierGood.businessId as Types.ObjectId,
                session
              );

            if (addSupplierGoodToInventoryResult !== true) {
              await session.abortTransaction();
              return reply.code(400).send({
                message:
                  "Supplier good updated but fail to add to inventory! Error: " +
                  addSupplierGoodToInventoryResult,
              });
            }
          }
        }

        await session.commitTransaction();

        return reply.code(200).send({
          message: "Supplier good updated successfully!",
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      return reply.code(500).send({
        message: "Create supplier good failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /supplierGoods/:supplierGoodId - delete (transaction)
  app.delete("/:supplierGoodId", async (req, reply) => {
    const params = req.params as { supplierGoodId?: string };
    const supplierGoodId = params.supplierGoodId;

    if (!supplierGoodId || isObjectIdValid([supplierGoodId]) !== true) {
      return reply.code(400).send({ message: "Invalid supplierGoodId!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const supplierGood = (await SupplierGood.findById(supplierGoodId)
        .select("businessId")
        .lean()) as unknown as ISupplierGood | null;

      if (!supplierGood) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Supplier good not found!" });
      }

      const isInUse = await BusinessGood.exists({
        businessId: supplierGood.businessId,
        "ingredients.supplierGoodId": supplierGoodId,
      });

      if (isInUse) {
        await session.abortTransaction();
        return reply.code(409).send({
          message: "Supplier good is in use in some business goods!",
        });
      }

      const deletedSupplierGood = await SupplierGood.findOneAndDelete(
        { _id: supplierGoodId },
        { session }
      );

      if (!deletedSupplierGood) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Supplier good not found!" });
      }

      const deleteSupplierGoodFromInventoryResult =
        await deleteSupplierGoodFromInventory(
          supplierGoodId,
          supplierGood.businessId,
          session
        );

      if (deleteSupplierGoodFromInventoryResult !== true) {
        await session.abortTransaction();
        return reply.code(400).send({
          message: deleteSupplierGoodFromInventoryResult,
        });
      }

      const folderPath = `/business/${deletedSupplierGood?.businessId}/suppliersGoods/${supplierGoodId}`;

      const deleteFolderCloudinaryResult: string | boolean =
        await deleteFolderCloudinary(folderPath);

      if (deleteFolderCloudinaryResult !== true) {
        await session.abortTransaction();
        return reply.code(400).send({ message: deleteFolderCloudinaryResult });
      }

      await session.commitTransaction();

      return reply.code(200).send({
        message: `Supplier good deleted successfully!`,
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Delete business good failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /supplierGoods/supplier/:supplierId - get by supplier
  app.get("/supplier/:supplierId", async (req, reply) => {
    const params = req.params as { supplierId?: string };
    const supplierId = params.supplierId;

    if (!supplierId || isObjectIdValid([supplierId]) !== true) {
      return reply.code(400).send({ message: "Invalid supplierId!" });
    }

    const supplierGoods = await SupplierGood.find({ supplierId }).lean();

    if (!supplierGoods.length) {
      return reply.code(404).send({ message: "No supplier goods found!" });
    }
    return reply.code(200).send(supplierGoods);
  });
};
