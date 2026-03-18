import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IBusinessGood, IIngredient } from "@shared/interfaces/IBusinessGood";

import { isObjectIdValid } from "../../utils/isObjectIdValid.js";
import BusinessGood from "../../models/businessGood.js";
import SupplierGood from "../../models/supplierGood.js";
import Promotion from "../../models/promotion.js";
import Order from "../../models/order.js";
import { uploadFilesCloudinary, UploadInputFile } from "../../cloudinary/uploadFilesCloudinary.js";
import { deleteFolderCloudinary } from "../../cloudinary/deleteFolderCloudinary.js";
import { calculateIngredientsCostPriceAndAllergies } from "../../businessGoods/calculateIngredientsCostPriceAndAllergies.js";
import { calculateSetMenuCostPriceAndAllergies } from "../../businessGoods/calculateSetMenuCostPriceAndAllergies.js";
import {
  mainCategoriesEnums,
  allergensEnums,
  measurementUnitEnums,
} from "../../enums.js";

export const businessGoodsRoutes: FastifyPluginAsync = async (app) => {
  // GET /businessGoods - list all business goods
  app.get("/", async (_req, reply) => {
    const businessGoods = await BusinessGood.find()
      .populate({
        path: "ingredients.supplierGoodId",
        select: "name mainCategory subCategory",
        model: SupplierGood,
      })
      .populate({
        path: "setMenuIds",
        select: "name mainCategory subCategory sellingPrice",
        model: BusinessGood,
      })
      .lean();

    if (!businessGoods.length) {
      return reply.code(404).send({ message: "No businessId goods found!" });
    }
    return reply.code(200).send(businessGoods);
  });

  // POST /businessGoods - create business good (formData with image)
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
      const onMenu = fields.onMenu === "true";
      const available = fields.available === "true";
      const sellingPrice = Number(fields.sellingPrice);
      const businessId = fields.businessId;

      const subCategory = fields.subCategory || undefined;
      const ingredients = fields.ingredients
        ? (JSON.parse(fields.ingredients) as IIngredient[])
        : undefined;
      const setMenuIds = fields.setMenuIds
        ? (JSON.parse(fields.setMenuIds) as string[])
        : [];
      const grossProfitMarginDesired = fields.grossProfitMarginDesired
        ? Number(fields.grossProfitMarginDesired)
        : undefined;
      const description = fields.description || undefined;
      const allergens = fields.allergens
        ? (JSON.parse(fields.allergens) as string[])
        : [];
      const deliveryTime = fields.deliveryTime
        ? Number(fields.deliveryTime)
        : undefined;

      if (
        !name ||
        !keyword ||
        !mainCategory ||
        onMenu === undefined ||
        available === undefined ||
        !sellingPrice ||
        !businessId
      ) {
        return reply.code(400).send({
          message:
            "Name, keyword, mainCategory, onMenu, available, sellingPrice and businessId are required!",
        });
      }

      if (isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Business ID is not valid!" });
      }

      if (files && files.length > 3) {
        return reply.code(400).send({ message: "Max file quantity is 3!" });
      }

      if (ingredients && ingredients.length > 0 && setMenuIds.length > 0) {
        return reply.code(400).send({
          message: "Only one of ingredients or setMenuIds can be assigned!",
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

      if (ingredients) {
        for (const ingredient of ingredients) {
          if (!(measurementUnitEnums as readonly string[]).includes(ingredient.measurementUnit)) {
            return reply.code(400).send({ message: "Invalid measurement unit!" });
          }
        }
      }

      const duplicateBusinessGood = await BusinessGood.exists({
        businessId,
        name,
      });

      if (duplicateBusinessGood) {
        return reply.code(400).send({
          message: `${name} already exists on businessId goods!`,
        });
      }

      const businessGoodId = new mongoose.Types.ObjectId();

      const newBusinessGood: Partial<IBusinessGood> = {
        _id: businessGoodId,
        name,
        keyword,
        mainCategory,
        onMenu,
        available,
        sellingPrice,
        businessId: new Types.ObjectId(businessId),
        subCategory: subCategory || undefined,
        setMenuIds: setMenuIds.length > 0 ? setMenuIds.map(id => new Types.ObjectId(id)) : undefined,
        grossProfitMarginDesired: grossProfitMarginDesired || undefined,
        description: description || undefined,
        deliveryTime: deliveryTime || undefined,
      };

      if (files.length > 0) {
        const folder = `/business/${businessId}/businessGoods/${businessGoodId}`;

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
          return reply.code(400).send({
            message: `Error uploading image: ${cloudinaryUploadResponse}`,
          });
        }

        newBusinessGood.imagesUrl = cloudinaryUploadResponse;
      }

      if (ingredients && ingredients.length > 0) {
        const calculateIngredientsCostPriceAndAllergiesResult =
          await calculateIngredientsCostPriceAndAllergies(ingredients);

        if (typeof calculateIngredientsCostPriceAndAllergiesResult !== "object") {
          return reply.code(400).send({
            message: calculateIngredientsCostPriceAndAllergiesResult,
          });
        }

        newBusinessGood.ingredients =
          calculateIngredientsCostPriceAndAllergiesResult.map((ing) => {
            return {
              supplierGoodId: ing.supplierGoodId,
              measurementUnit: ing.measurementUnit,
              requiredQuantity: ing.requiredQuantity ?? 0,
              costOfRequiredQuantity: ing.costOfRequiredQuantity,
            };
          });

        newBusinessGood.setMenuIds = undefined;

        newBusinessGood.costPrice = parseFloat(
          calculateIngredientsCostPriceAndAllergiesResult
            .reduce((acc, curr) => acc + curr.costOfRequiredQuantity, 0)
            .toFixed(2)
        );

        const reducedAllergens =
          calculateIngredientsCostPriceAndAllergiesResult.reduce(
            (acc: string[], curr) => {
              if (curr.allergens) {
                curr.allergens.forEach((allergen) => {
                  if (!acc.includes(allergen)) {
                    acc.push(allergen);
                  }
                });
              }
              return acc;
            },
            []
          );

        const allergensArr = [...allergens];
        allergensArr.push(
          ...reducedAllergens.filter((item) => !allergensArr.includes(item))
        );

        newBusinessGood.allergens =
          allergensArr.length > 0 ? allergensArr : undefined;
      }

      if (setMenuIds && setMenuIds.length > 0) {
        const calculateSetMenuCostPriceAndAllergiesResult =
          await calculateSetMenuCostPriceAndAllergies(setMenuIds);

        if (typeof calculateSetMenuCostPriceAndAllergiesResult !== "object") {
          return reply.code(400).send({
            message: calculateSetMenuCostPriceAndAllergiesResult,
          });
        }

        newBusinessGood.ingredients = undefined;
        newBusinessGood.setMenuIds = setMenuIds.map(id => new Types.ObjectId(id));

        newBusinessGood.costPrice = parseFloat(
          calculateSetMenuCostPriceAndAllergiesResult.costPrice.toFixed(2)
        );

        newBusinessGood.allergens =
          calculateSetMenuCostPriceAndAllergiesResult.allergens &&
          calculateSetMenuCostPriceAndAllergiesResult.allergens.length > 0
            ? calculateSetMenuCostPriceAndAllergiesResult.allergens
            : undefined;
      }

      if (newBusinessGood.costPrice && grossProfitMarginDesired) {
        newBusinessGood.suggestedSellingPrice = parseFloat(
          (
            newBusinessGood.costPrice *
            (1 + grossProfitMarginDesired / 100)
          ).toFixed(2)
        );
      }

      await BusinessGood.create(newBusinessGood);

      return reply.code(201).send({
        message: `BusinessId good created successfully!`,
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Create businessId good failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /businessGoods/:businessGoodId - get by ID
  app.get("/:businessGoodId", async (req, reply) => {
    const params = req.params as { businessGoodId?: string };
    const businessGoodId = params.businessGoodId;

    if (!businessGoodId || isObjectIdValid([businessGoodId]) !== true) {
      return reply.code(400).send({ message: "Invalid businessGoodId!" });
    }

    const businessGood = await BusinessGood.findById(businessGoodId)
      .populate({
        path: "ingredients.supplierGoodId",
        select: "name mainCategory subCategory",
        model: SupplierGood,
      })
      .populate({
        path: "setMenuIds",
        select: "name mainCategory subCategory sellingPrice",
        model: BusinessGood,
      })
      .lean();

    if (!businessGood) {
      return reply.code(404).send({ message: "No business good found!" });
    }
    return reply.code(200).send(businessGood);
  });

  // PATCH /businessGoods/:businessGoodId - update (formData with image)
  app.patch("/:businessGoodId", async (req, reply) => {
    try {
      const params = req.params as { businessGoodId?: string };
      const businessGoodId = params.businessGoodId;

      if (!businessGoodId || isObjectIdValid([businessGoodId]) !== true) {
        return reply.code(400).send({ message: "Invalid businessGoodId!" });
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
      const onMenu = fields.onMenu === "true";
      const available = fields.available === "true";
      const sellingPrice = Number(fields.sellingPrice);
      const businessId = fields.businessId;

      const subCategory = fields.subCategory || undefined;
      const ingredients = fields.ingredients
        ? JSON.parse(fields.ingredients)
        : undefined;
      const setMenuIds = fields.setMenuIds
        ? (JSON.parse(fields.setMenuIds) as string[])
        : [];
      const grossProfitMarginDesired = fields.grossProfitMarginDesired
        ? Number(fields.grossProfitMarginDesired)
        : undefined;
      const description = fields.description || undefined;
      const allergens = fields.allergens
        ? (JSON.parse(fields.allergens) as string[])
        : [];
      const deliveryTime = fields.deliveryTime
        ? Number(fields.deliveryTime)
        : undefined;

      if (
        !name ||
        !keyword ||
        !mainCategory ||
        onMenu === undefined ||
        available === undefined ||
        !sellingPrice ||
        !businessId
      ) {
        return reply.code(400).send({
          message:
            "Name, keyword, mainCategory, onMenu, available, sellingPrice and businessId are required!",
        });
      }

      if (ingredients && ingredients.length > 0 && setMenuIds.length > 0) {
        return reply.code(400).send({
          message: "Only one of ingredients or setMenuIds can be assigned!",
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

      if (ingredients) {
        for (const ingredient of ingredients) {
          if (!(measurementUnitEnums as readonly string[]).includes(ingredient.measurementUnit)) {
            return reply.code(400).send({ message: "Invalid measurement unit!" });
          }
        }
      }

      const businessGood = (await BusinessGood.findById(businessGoodId).lean()) as IBusinessGood | null;

      if (!businessGood) {
        return reply.code(404).send({ message: "Business good not found!" });
      }

      if (files && files.length + (businessGood?.imagesUrl?.length || 0) > 3) {
        return reply.code(400).send({ message: "Max file quantity is 3!" });
      }

      const duplicateBusinessGood = await BusinessGood.exists({
        _id: { $ne: businessGoodId },
        businessId: businessGood.businessId,
        name,
      });

      if (duplicateBusinessGood) {
        return reply.code(409).send({ message: `Business good ${name} already exists!` });
      }

      const updatedBusinessGoodObj: Partial<IBusinessGood> = {};

      if (name !== businessGood?.name) updatedBusinessGoodObj.name = name;
      if (keyword !== businessGood?.keyword)
        updatedBusinessGoodObj.keyword = keyword;
      if (mainCategory !== businessGood?.mainCategory)
        updatedBusinessGoodObj.mainCategory = mainCategory;
      if (onMenu !== businessGood?.onMenu) updatedBusinessGoodObj.onMenu = onMenu;
      if (available !== businessGood?.available)
        updatedBusinessGoodObj.available = available;
      if (sellingPrice !== businessGood?.sellingPrice)
        updatedBusinessGoodObj.sellingPrice = sellingPrice;

      if (subCategory && subCategory !== businessGood?.subCategory)
        updatedBusinessGoodObj.subCategory = subCategory;
      if (
        grossProfitMarginDesired &&
        grossProfitMarginDesired !== businessGood?.grossProfitMarginDesired
      )
        updatedBusinessGoodObj.grossProfitMarginDesired =
          grossProfitMarginDesired;
      if (description && description !== businessGood?.description)
        updatedBusinessGoodObj.description = description;
      if (allergens && allergens !== businessGood?.allergens)
        updatedBusinessGoodObj.allergens = allergens;
      if (deliveryTime && deliveryTime !== businessGood?.deliveryTime)
        updatedBusinessGoodObj.deliveryTime = deliveryTime;

      if (files.length > 0) {
        const folder = `/business/${businessGood?.businessId}/businessGoods/${businessGoodId}`;

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
          return reply.code(400).send({
            message: `Error uploading image: ${cloudinaryUploadResponse}`,
          });
        }

        updatedBusinessGoodObj.imagesUrl = [
          ...(businessGood?.imagesUrl || []),
          ...cloudinaryUploadResponse,
        ];
      }

      if (ingredients && ingredients.length > 0) {
        const calculateIngredientsCostPriceAndAllergiesResult =
          await calculateIngredientsCostPriceAndAllergies(ingredients);

        if (typeof calculateIngredientsCostPriceAndAllergiesResult !== "object") {
          return reply.code(400).send({
            message: calculateIngredientsCostPriceAndAllergiesResult,
          });
        }

        updatedBusinessGoodObj.ingredients =
          calculateIngredientsCostPriceAndAllergiesResult.map((ing) => {
            return {
              supplierGoodId: ing.supplierGoodId,
              measurementUnit: ing.measurementUnit,
              requiredQuantity: ing.requiredQuantity ?? 0,
              costOfRequiredQuantity: ing.costOfRequiredQuantity,
            };
          });

        updatedBusinessGoodObj.setMenuIds = [];

        updatedBusinessGoodObj.costPrice = parseFloat(
          calculateIngredientsCostPriceAndAllergiesResult
            .reduce((acc, curr) => acc + curr.costOfRequiredQuantity, 0)
            .toFixed(2)
        );

        const reducedAllergens =
          calculateIngredientsCostPriceAndAllergiesResult.reduce(
            (acc: string[], curr) => {
              if (curr.allergens) {
                curr.allergens.forEach((allergen) => {
                  if (!acc.includes(allergen)) {
                    acc.push(allergen);
                  }
                });
              }
              return acc;
            },
            []
          );

        const allergensArr = [...allergens];
        allergensArr.push(
          ...reducedAllergens.filter((item) => !allergensArr.includes(item))
        );

        updatedBusinessGoodObj.allergens =
          allergensArr.length > 0 ? allergensArr : undefined;
      }

      if (setMenuIds && setMenuIds.length > 0) {
        const calculateSetMenuCostPriceAndAllergiesResult =
          await calculateSetMenuCostPriceAndAllergies(setMenuIds);

        if (typeof calculateSetMenuCostPriceAndAllergiesResult !== "object") {
          return reply.code(400).send({
            message: calculateSetMenuCostPriceAndAllergiesResult,
          });
        }

        updatedBusinessGoodObj.ingredients = [];

        updatedBusinessGoodObj.setMenuIds = setMenuIds.map(id => new Types.ObjectId(id));

        updatedBusinessGoodObj.costPrice = parseFloat(
          calculateSetMenuCostPriceAndAllergiesResult.costPrice.toFixed(2)
        );

        updatedBusinessGoodObj.allergens =
          calculateSetMenuCostPriceAndAllergiesResult.allergens &&
          calculateSetMenuCostPriceAndAllergiesResult.allergens.length > 0
            ? calculateSetMenuCostPriceAndAllergiesResult.allergens
            : undefined;
      }

      if (updatedBusinessGoodObj.costPrice && grossProfitMarginDesired) {
        updatedBusinessGoodObj.suggestedSellingPrice = parseFloat(
          (
            updatedBusinessGoodObj.costPrice *
            (1 + grossProfitMarginDesired / 100)
          ).toFixed(2)
        );
      }

      const updateBusinessGood = await BusinessGood.findByIdAndUpdate(
        businessGoodId,
        { $set: updatedBusinessGoodObj },
        { new: true, lean: true }
      );

      if (!updateBusinessGood) {
        return reply.code(404).send({ message: "Business good to update not found!" });
      }

      return reply.code(200).send({
        message: `Business good updated successfully!`,
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Update business good failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /businessGoods/:businessGoodId - delete with transaction
  app.delete("/:businessGoodId", async (req, reply) => {
    const params = req.params as { businessGoodId?: string };
    const businessGoodId = params.businessGoodId;

    if (!businessGoodId || isObjectIdValid([businessGoodId]) !== true) {
      return reply.code(400).send({ message: "Invalid businessGoodId!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [businessGoodInOrders, businessGoodInSetMenu] = await Promise.all([
        Order.exists({
          $or: [
            { businessGoodId, billingStatus: "Open" },
            { addOns: businessGoodId, billingStatus: "Open" },
          ],
        }),
        BusinessGood.exists({
          setMenuIds: businessGoodId,
        }),
      ]);

      if (businessGoodInOrders || businessGoodInSetMenu) {
        await session.abortTransaction();
        return reply.code(400).send({
          message: businessGoodInOrders
            ? "Cannot delete Business good because it is in some open orders!"
            : "Cannot delete Business good because it is in some set menu!",
        });
      }

      const [deletedBusinessGood] = await Promise.all([
        BusinessGood.findOneAndDelete({ _id: businessGoodId }, { session }),
        Promotion.updateMany(
          { businessGoodsToApplyIds: businessGoodId },
          { $pull: { businessGoodsToApplyIds: businessGoodId } },
          { session }
        ),
      ]);

      if (!deletedBusinessGood) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Business good not found!" });
      }

      const folderPath = `/business/${deletedBusinessGood?.businessId}/businessGoods/${businessGoodId}`;

      const deleteFolderCloudinaryResult: string | boolean =
        await deleteFolderCloudinary(folderPath);

      if (deleteFolderCloudinaryResult !== true) {
        await session.abortTransaction();
        return reply.code(400).send({ message: deleteFolderCloudinaryResult });
      }

      await session.commitTransaction();

      return reply.code(200).send({
        message: `Business good ${businessGoodId} deleted successfully!`,
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

  // GET /businessGoods/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid businessId!" });
    }

    const businessGoods = await BusinessGood.find({ businessId })
      .populate({
        path: "ingredients.supplierGoodId",
        select: "name mainCategory subCategory",
        model: SupplierGood,
      })
      .populate({
        path: "setMenuIds",
        select: "name mainCategory subCategory sellingPrice",
        model: BusinessGood,
      })
      .lean();

    if (!businessGoods.length) {
      return reply.code(404).send({ message: "No business goods found!" });
    }
    return reply.code(200).send(businessGoods);
  });
};
