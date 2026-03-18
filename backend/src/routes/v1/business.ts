import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import { hash } from "bcrypt";
import Business from "../../models/business.js";
import BusinessGood from "../../models/businessGood.js";
import DailySalesReport from "../../models/dailySalesReport.js";
import Employee from "../../models/employee.js";
import Inventory from "../../models/inventory.js";
import MonthlyBusinessReport from "../../models/monthlyBusinessReport.js";
import Notification from "../../models/notification.js";
import Order from "../../models/order.js";
import Printer from "../../models/printer.js";
import Promotion from "../../models/promotion.js";
import Purchase from "../../models/purchase.js";
import Rating from "../../models/rating.js";
import Reservation from "../../models/reservation.js";
import SalesInstance from "../../models/salesInstance.js";
import SalesPoint from "../../models/salesPoint.js";
import Schedule from "../../models/schedule.js";
import SupplierGood from "../../models/supplierGood.js";
import Supplier from "../../models/supplier.js";
import User from "../../models/user.js";
import { isObjectIdValid } from "../../utils/isObjectIdValid.js";
import { subscriptionEnums, currenctyEnums } from "../../enums.js";
import { uploadFilesCloudinary } from "../../cloudinary/uploadFilesCloudinary.js";
import { deleteFilesCloudinary } from "../../cloudinary/deleteFilesCloudinary.js";
import { deleteFolderCloudinary } from "../../cloudinary/deleteFolderCloudinary.js";
import objDefaultValidation from "@shared/utils/objDefaultValidation";

const DEFAULT_DISCOVERY_LIMIT = 50;

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];
const nonReqAddressFields = ["region", "additionalDetails", "coordinates"];

const reqMetrics = [
  "foodCostPercentage",
  "beverageCostPercentage",
  "laborCostPercentage",
  "fixedCostPercentage",
  "supplierGoodWastePercentage",
];

const reqSupplierGoodWastePercentage = [
  "veryLowBudgetImpact",
  "lowBudgetImpact",
  "mediumBudgetImpact",
  "hightBudgetImpact",
  "veryHightBudgetImpact",
];

function haversineKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const businessRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;

    const cuisineType = q.cuisineType ?? undefined;
    const categoriesParam = q.categories ?? undefined;
    const name = q.name ?? q.tradeName ?? undefined;
    const minRatingParam = q.rating ?? q.minRating ?? undefined;
    const latParam = q.lat ?? undefined;
    const lngParam = q.lng ?? undefined;
    const radiusKmParam = q.radius ?? undefined;
    const limitParam = q.limit ?? undefined;

    const hasFilters =
      cuisineType !== undefined ||
      categoriesParam !== undefined ||
      name !== undefined ||
      minRatingParam !== undefined ||
      (latParam !== undefined && lngParam !== undefined);

    let businesses: unknown[];

    if (!hasFilters) {
      businesses = await Business.find().select("-password").lean();
    } else {
      const filter: Record<string, unknown> = {};

      if (cuisineType) filter.cuisineType = cuisineType;

      if (categoriesParam) {
        const categories = categoriesParam
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (categories.length > 0) filter.categories = { $in: categories };
      }

      if (name) {
        filter.tradeName = { $regex: name, $options: "i" };
      }

      if (minRatingParam !== undefined && minRatingParam !== "") {
        const minRating = Number(minRatingParam);
        if (!Number.isNaN(minRating) && minRating >= 0 && minRating <= 5) {
          filter.averageRating = { $gte: minRating };
          filter.ratingCount = { $gte: 1 };
        }
      }

      const limit = limitParam
        ? Math.min(
            Math.max(1, Number(limitParam) || DEFAULT_DISCOVERY_LIMIT),
            100
          )
        : DEFAULT_DISCOVERY_LIMIT;

      businesses = await Business.find(filter)
        .select("-password")
        .limit(limit)
        .lean();
    }

    if (latParam !== undefined && lngParam !== undefined && businesses.length > 0) {
      const lat = Number(latParam);
      const lng = Number(lngParam);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        const radiusKm =
          radiusKmParam !== undefined && radiusKmParam !== ""
            ? Number(radiusKmParam)
            : null;

        type BizWithCoords = {
          address?: { coordinates?: [number, number] };
          [key: string]: unknown;
        };
        const withCoords = (businesses as BizWithCoords[]).filter(
          (b) =>
            Array.isArray(b.address?.coordinates) &&
            b.address.coordinates.length >= 2
        );
        const withDistance = withCoords.map((b) => {
          const [lon, coordLat] = (b.address as { coordinates: [number, number] })
            .coordinates;
          const km = haversineKm(lng, lat, lon, coordLat);
          return { ...b, _distanceKm: km };
        });
        const filtered =
          radiusKm !== null && !Number.isNaN(radiusKm)
            ? withDistance.filter(
                (b) => (b as { _distanceKm: number })._distanceKm <= radiusKm
              )
            : withDistance;
        const sorted = [...filtered].sort(
          (a, b) =>
            (a as { _distanceKm: number })._distanceKm -
            (b as { _distanceKm: number })._distanceKm
        );
        businesses = sorted.map(({ _distanceKm, ...rest }) => rest);
      }
    }

    if (!businesses.length) {
      return reply.code(400).send({ message: "No business found!" });
    }

    return reply.code(200).send(businesses);
  });

  app.get("/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid businessId!" });
    }

    const business = await Business.findById(businessId).select("-password").lean();

    if (!business) {
      return reply.code(404).send({ message: "No business found!" });
    }

    return reply.code(200).send(business);
  });

  app.post("/", async (req, reply) => {
    // This endpoint mirrors `app/api/v1/business/route.ts` (FormData + optional image).
    const fields: Record<string, string> = {};
    let imageFile:
      | { buffer: Buffer; mimeType: string; filename?: string }
      | undefined;

    // `@fastify/multipart` provides async iterator parts()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = (req as any).parts?.();
    if (!parts || typeof parts[Symbol.asyncIterator] !== "function") {
      return reply
        .code(400)
        .send({ message: "Expected multipart/form-data" });
    }

    for await (const part of parts) {
      if (part.type === "file") {
        if (part.fieldname === "imageUrl") {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk as Buffer);
          imageFile = {
            buffer: Buffer.concat(chunks),
            mimeType: part.mimetype,
            filename: part.filename,
          };
        }
      } else {
        fields[part.fieldname] = String(part.value ?? "");
      }
    }

    const tradeName = fields.tradeName;
    const legalName = fields.legalName;
    const email = fields.email;
    const password = fields.password;
    const phoneNumber = fields.phoneNumber;
    const taxNumber = fields.taxNumber;
    const subscription = fields.subscription;
    const currencyTrade = fields.currencyTrade;
    const contactPerson = fields.contactPerson || undefined;
    const cuisineType = fields.cuisineType || undefined;
    const categoriesStr = fields.categories || undefined;
    const averageRatingStr = fields.averageRating || undefined;
    const ratingCountStr = fields.ratingCount || undefined;
    const acceptsDeliveryStr = fields.acceptsDelivery || undefined;
    const deliveryRadiusStr = fields.deliveryRadius || undefined;
    const minOrderStr = fields.minOrder || undefined;
    const businessOpeningHoursStr = fields.businessOpeningHours || undefined;
    const deliveryOpeningWindowsStr = fields.deliveryOpeningWindows || undefined;

    let address: unknown = undefined;
    try {
      address = fields.address ? JSON.parse(fields.address) : undefined;
    } catch {
      address = undefined;
    }

    if (
      !tradeName ||
      !legalName ||
      !email ||
      !password ||
      !phoneNumber ||
      !taxNumber ||
      !subscription ||
      !address ||
      !currencyTrade
    ) {
      return reply.code(400).send({
        message:
          "TradeName, legalName, email, password, phoneNumber, taxNumber, subscription, currencyTrade and address are required!",
      });
    }

    if (!emailRegex.test(email)) {
      return reply.code(400).send({ message: "Invalid email format!" });
    }

    if (!passwordRegex.test(password)) {
      return reply.code(400).send({
        message:
          "Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character!",
      });
    }

    const addressValidationResult = objDefaultValidation(
      address as object,
      reqAddressFields,
      nonReqAddressFields
    );
    if (addressValidationResult !== true) {
      return reply.code(400).send({ message: addressValidationResult });
    }

    if (!(subscriptionEnums as readonly string[]).includes(subscription)) {
      return reply.code(400).send({ message: "Invalid subscription!" });
    }

    if (!(currenctyEnums as readonly string[]).includes(currencyTrade)) {
      return reply.code(400).send({ message: "Invalid currencyTrade!" });
    }

    const duplicateBusiness = await Business.exists({
      $or: [{ legalName }, { email }, { taxNumber }],
    });
    if (duplicateBusiness) {
      return reply.code(409).send({
        message: `Business ${legalName}, ${email} or ${taxNumber} already exists!`,
      });
    }

    const hashedPassword = await hash(password, 10);
    const businessId = new Types.ObjectId();

    const newBusiness: Record<string, unknown> = {
      _id: businessId,
      tradeName,
      legalName,
      email,
      password: hashedPassword,
      phoneNumber,
      taxNumber,
      currencyTrade,
      subscription,
      address,
      contactPerson: contactPerson || undefined,
    };

    if (cuisineType) newBusiness.cuisineType = cuisineType;

    if (categoriesStr) {
      try {
        const parsed = JSON.parse(categoriesStr) as string[];
        if (Array.isArray(parsed)) {
          newBusiness.categories = parsed
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
        }
      } catch {
        // ignore invalid JSON
      }
    }

    if (averageRatingStr !== undefined && averageRatingStr !== "") {
      const n = Number(averageRatingStr);
      if (!Number.isNaN(n) && n >= 0 && n <= 5) newBusiness.averageRating = n;
    }
    if (ratingCountStr !== undefined && ratingCountStr !== "") {
      const n = Number(ratingCountStr);
      if (!Number.isNaN(n) && n >= 0) newBusiness.ratingCount = n;
    }
    if (acceptsDeliveryStr !== undefined && acceptsDeliveryStr !== "") {
      newBusiness.acceptsDelivery = acceptsDeliveryStr === "true";
    }
    if (deliveryRadiusStr !== undefined && deliveryRadiusStr !== "") {
      const n = Number(deliveryRadiusStr);
      if (!Number.isNaN(n) && n >= 0) newBusiness.deliveryRadius = n;
    }
    if (minOrderStr !== undefined && minOrderStr !== "") {
      const n = Number(minOrderStr);
      if (!Number.isNaN(n) && n >= 0) newBusiness.minOrder = n;
    }
    if (businessOpeningHoursStr) {
      try {
        const parsed = JSON.parse(businessOpeningHoursStr) as unknown;
        if (Array.isArray(parsed)) newBusiness.businessOpeningHours = parsed;
      } catch {
        // ignore invalid JSON
      }
    }
    if (deliveryOpeningWindowsStr) {
      try {
        const parsed = JSON.parse(deliveryOpeningWindowsStr) as unknown;
        if (Array.isArray(parsed)) newBusiness.deliveryOpeningWindows = parsed;
      } catch {
        // ignore invalid JSON
      }
    }

    if (imageFile && imageFile.buffer.length > 0) {
      const folder = `/business/${businessId}`;
      const uploaded = await uploadFilesCloudinary({
        folder,
        filesArr: [{ buffer: imageFile.buffer, mimeType: imageFile.mimeType }],
        onlyImages: true,
      });

      if (
        typeof uploaded === "string" ||
        uploaded.length === 0 ||
        !uploaded.every((u) => u.includes("https://"))
      ) {
        return reply.code(400).send({
          message: `Error uploading image: ${uploaded}`,
        });
      }

      newBusiness.imageUrl = uploaded[0];
    }

    await Business.create(newBusiness);

    return reply.code(201).send({ message: `Business ${legalName} created` });
  });

  app.patch("/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid businessId!" });
    }

    const fields: Record<string, string> = {};
    let imageFile:
      | { buffer: Buffer; mimeType: string; filename?: string }
      | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = (req as any).parts?.();
    if (!parts || typeof parts[Symbol.asyncIterator] !== "function") {
      return reply.code(400).send({ message: "Expected multipart/form-data" });
    }

    for await (const part of parts) {
      if (part.type === "file") {
        if (part.fieldname === "imageUrl") {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk as Buffer);
          imageFile = {
            buffer: Buffer.concat(chunks),
            mimeType: part.mimetype,
            filename: part.filename,
          };
        }
      } else {
        fields[part.fieldname] = String(part.value ?? "");
      }
    }

    const tradeName = fields.tradeName;
    const legalName = fields.legalName;
    const email = fields.email;
    const phoneNumber = fields.phoneNumber;
    const taxNumber = fields.taxNumber;
    const currencyTrade = fields.currencyTrade;
    const subscription = fields.subscription;
    const password = fields.password || undefined;
    const contactPerson = fields.contactPerson || undefined;
    const cuisineType = fields.cuisineType || undefined;
    const categoriesStr = fields.categories || undefined;
    const averageRatingStr = fields.averageRating || undefined;
    const ratingCountStr = fields.ratingCount || undefined;
    const acceptsDeliveryStr = fields.acceptsDelivery || undefined;
    const deliveryRadiusStr = fields.deliveryRadius || undefined;
    const minOrderStr = fields.minOrder || undefined;
    const businessOpeningHoursStr = fields.businessOpeningHours || undefined;
    const deliveryOpeningWindowsStr = fields.deliveryOpeningWindows || undefined;

    let address: Record<string, unknown> | undefined = undefined;
    try {
      address = fields.address ? JSON.parse(fields.address) : undefined;
    } catch {
      address = undefined;
    }

    let metrics: Record<string, unknown> | undefined = undefined;
    try {
      metrics = fields.metrics ? JSON.parse(fields.metrics) : undefined;
    } catch {
      metrics = undefined;
    }

    if (
      !tradeName ||
      !legalName ||
      !email ||
      !phoneNumber ||
      !taxNumber ||
      !subscription ||
      !address ||
      !currencyTrade
    ) {
      return reply.code(400).send({
        message:
          "TradeName, legalName, email, phoneNumber, taxNumber, subscription, currencyTrade and address are required!",
      });
    }

    if (!emailRegex.test(email)) {
      return reply.code(400).send({ message: "Invalid email format!" });
    }

    if (password && !passwordRegex.test(password)) {
      return reply.code(400).send({
        message:
          "Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character!",
      });
    }

    const addressValidationResult = objDefaultValidation(
      address as object,
      reqAddressFields,
      nonReqAddressFields
    );
    if (addressValidationResult !== true) {
      return reply.code(400).send({ message: addressValidationResult });
    }

    if (metrics) {
      const metricsValidationResult = objDefaultValidation(
        metrics as object,
        reqMetrics,
        []
      );
      if (metricsValidationResult !== true) {
        return reply.code(400).send({ message: metricsValidationResult });
      }

      const supplierGoodWastePercentageValidationResult = objDefaultValidation(
        metrics.supplierGoodWastePercentage as object,
        reqSupplierGoodWastePercentage,
        []
      );
      if (supplierGoodWastePercentageValidationResult !== true) {
        return reply.code(400).send({
          message: supplierGoodWastePercentageValidationResult,
        });
      }
    }

    if (!(subscriptionEnums as readonly string[]).includes(subscription)) {
      return reply.code(400).send({ message: "Invalid subscription!" });
    }

    if (!(currenctyEnums as readonly string[]).includes(currencyTrade)) {
      return reply.code(400).send({ message: "Invalid currencyTrade!" });
    }

    if (averageRatingStr !== undefined && averageRatingStr !== "") {
      const n = Number(averageRatingStr);
      if (Number.isNaN(n) || n < 0 || n > 5) {
        return reply.code(400).send({
          message: "averageRating must be between 0 and 5!",
        });
      }
    }
    if (ratingCountStr !== undefined && ratingCountStr !== "") {
      const n = Number(ratingCountStr);
      if (Number.isNaN(n) || n < 0) {
        return reply.code(400).send({
          message: "ratingCount must be a non-negative number!",
        });
      }
    }
    if (categoriesStr !== undefined && categoriesStr !== "") {
      try {
        const parsed = JSON.parse(categoriesStr) as unknown;
        if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
          return reply.code(400).send({
            message: "categories must be an array of strings!",
          });
        }
      } catch {
        return reply.code(400).send({
          message: "categories must be a valid JSON array of strings!",
        });
      }
    }
    if (deliveryRadiusStr !== undefined && deliveryRadiusStr !== "") {
      const n = Number(deliveryRadiusStr);
      if (Number.isNaN(n) || n < 0) {
        return reply.code(400).send({
          message: "deliveryRadius must be a non-negative number!",
        });
      }
    }
    if (minOrderStr !== undefined && minOrderStr !== "") {
      const n = Number(minOrderStr);
      if (Number.isNaN(n) || n < 0) {
        return reply.code(400).send({
          message: "minOrder must be a non-negative number!",
        });
      }
    }

    const duplicateBusiness = await Business.exists({
      _id: { $ne: businessId },
      $or: [{ legalName }, { email }, { taxNumber }],
    });
    if (duplicateBusiness) {
      return reply.code(409).send({
        message: `Business legalname, email or taxNumber already exists!`,
      });
    }

    const business = await Business.findById(businessId).lean();
    if (!business) {
      return reply.code(404).send({ message: "Business not found!" });
    }

    const updateBusinessObj: Record<string, unknown> = {};

    if (tradeName !== (business as Record<string, unknown>).tradeName)
      updateBusinessObj.tradeName = tradeName;
    if (legalName !== (business as Record<string, unknown>).legalName)
      updateBusinessObj.legalName = legalName;
    if (email !== (business as Record<string, unknown>).email)
      updateBusinessObj.email = email;
    if (phoneNumber !== (business as Record<string, unknown>).phoneNumber)
      updateBusinessObj.phoneNumber = phoneNumber;
    if (taxNumber !== (business as Record<string, unknown>).taxNumber)
      updateBusinessObj.taxNumber = taxNumber;
    if (currencyTrade !== (business as Record<string, unknown>).currencyTrade)
      updateBusinessObj.currencyTrade = currencyTrade;
    if (subscription !== (business as Record<string, unknown>).subscription)
      updateBusinessObj.subscription = subscription;
    if (contactPerson && contactPerson !== (business as Record<string, unknown>).contactPerson)
      updateBusinessObj.contactPerson = contactPerson;

    if (cuisineType !== undefined)
      updateBusinessObj.cuisineType = cuisineType || undefined;
    if (categoriesStr !== undefined) {
      try {
        const parsed = JSON.parse(categoriesStr) as string[];
        if (Array.isArray(parsed))
          updateBusinessObj.categories = parsed
            .map((s) => String(s).trim().toLowerCase())
            .filter(Boolean);
      } catch {
        // leave unchanged
      }
    }
    if (averageRatingStr !== undefined && averageRatingStr !== "") {
      const n = Number(averageRatingStr);
      if (!Number.isNaN(n) && n >= 0 && n <= 5) updateBusinessObj.averageRating = n;
    }
    if (ratingCountStr !== undefined && ratingCountStr !== "") {
      const n = Number(ratingCountStr);
      if (!Number.isNaN(n) && n >= 0) updateBusinessObj.ratingCount = n;
    }
    if (acceptsDeliveryStr !== undefined && acceptsDeliveryStr !== "")
      updateBusinessObj.acceptsDelivery = acceptsDeliveryStr === "true";
    if (deliveryRadiusStr !== undefined && deliveryRadiusStr !== "") {
      const n = Number(deliveryRadiusStr);
      if (!Number.isNaN(n) && n >= 0) updateBusinessObj.deliveryRadius = n;
    }
    if (minOrderStr !== undefined && minOrderStr !== "") {
      const n = Number(minOrderStr);
      if (!Number.isNaN(n) && n >= 0) updateBusinessObj.minOrder = n;
    }
    if (businessOpeningHoursStr !== undefined) {
      try {
        const parsed = JSON.parse(businessOpeningHoursStr) as unknown;
        if (Array.isArray(parsed)) {
          updateBusinessObj.businessOpeningHours = parsed;
        } else if (businessOpeningHoursStr === "") {
          updateBusinessObj.businessOpeningHours = undefined;
        }
      } catch {
        // leave unchanged
      }
    }
    if (deliveryOpeningWindowsStr !== undefined) {
      try {
        const parsed = JSON.parse(deliveryOpeningWindowsStr) as unknown;
        if (Array.isArray(parsed)) {
          updateBusinessObj.deliveryOpeningWindows = parsed;
        } else if (deliveryOpeningWindowsStr === "") {
          updateBusinessObj.deliveryOpeningWindows = undefined;
        }
      } catch {
        // leave unchanged
      }
    }

    const businessAddress = (business as Record<string, unknown>).address as
      | Record<string, unknown>
      | undefined;
    const updatedAddress: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(address)) {
      if (value !== businessAddress?.[key]) {
        updatedAddress[key] = value;
      }
    }
    if (Object.keys(updatedAddress).length > 0)
      updateBusinessObj.address = updatedAddress;

    if (metrics) {
      const businessMetrics = (business as Record<string, unknown>).metrics as
        | Record<string, unknown>
        | undefined;
      const updatedMetrics: Record<string, unknown> = {};
      const updatedSupplierGoodWastePercentage: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(metrics)) {
        if (key !== "supplierGoodWastePercentage") {
          if (value !== businessMetrics?.[key]) {
            updatedMetrics[key] = value;
          }
        } else {
          const metricsSupplierWaste = metrics.supplierGoodWastePercentage as Record<
            string,
            unknown
          >;
          const businessSupplierWaste = (businessMetrics?.supplierGoodWastePercentage ||
            {}) as Record<string, unknown>;
          for (const [wKey, wValue] of Object.entries(metricsSupplierWaste)) {
            if (wValue !== businessSupplierWaste[wKey]) {
              updatedSupplierGoodWastePercentage[wKey] = wValue;
            }
          }
        }
      }
      if (Object.keys(updatedSupplierGoodWastePercentage).length > 0)
        updatedMetrics.supplierGoodWastePercentage = updatedSupplierGoodWastePercentage;
      if (Object.keys(updatedMetrics).length > 0)
        updateBusinessObj.metrics = updatedMetrics;
    }

    if (imageFile && imageFile.buffer.length > 0) {
      const folder = `/business/${businessId}`;

      const cloudinaryUploadResponse = await uploadFilesCloudinary({
        folder,
        filesArr: [{ buffer: imageFile.buffer, mimeType: imageFile.mimeType }],
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

      const existingImageUrl = (business as Record<string, unknown>).imageUrl as
        | string
        | undefined;
      const deleteFilesCloudinaryResult = await deleteFilesCloudinary(existingImageUrl);

      if (deleteFilesCloudinaryResult !== true) {
        return reply.code(400).send({ message: deleteFilesCloudinaryResult });
      }

      updateBusinessObj.imageUrl = cloudinaryUploadResponse[0];
    }

    if (password) {
      updateBusinessObj.password = await hash(password, 10);
    }

    const updatedBusiness = await Business.findByIdAndUpdate(
      businessId,
      { $set: updateBusinessObj },
      { new: true, lean: true }
    );

    if (!updatedBusiness) {
      return reply.code(404).send({ message: "Business to update not found!" });
    }

    return reply.code(200).send({ message: "Business updated successfully" });
  });

  app.delete("/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid businessId!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Promise.all([
        Business.deleteOne({ _id: businessId }, { session }),
        BusinessGood.deleteMany({ businessId }, { session }),
        DailySalesReport.deleteMany({ businessId }, { session }),
        Employee.deleteMany({ businessId }, { session }),
        Inventory.deleteMany({ businessId }, { session }),
        MonthlyBusinessReport.deleteMany({ businessId }, { session }),
        Notification.deleteMany({ businessId }, { session }),
        Order.deleteMany({ businessId }, { session }),
        Printer.deleteMany({ businessId }, { session }),
        Promotion.deleteMany({ businessId }, { session }),
        Purchase.deleteMany({ businessId }, { session }),
        Rating.deleteMany({ businessId }, { session }),
        Reservation.deleteMany({ businessId }, { session }),
        SalesInstance.deleteMany({ businessId }, { session }),
        SalesPoint.deleteMany({ businessId }, { session }),
        Schedule.deleteMany({ businessId }, { session }),
        SupplierGood.deleteMany({ businessId }, { session }),
        Supplier.deleteMany({ businessId }, { session }),
        User.deleteMany({ businessId }, { session }),
      ]);

      await session.commitTransaction();

      const folderPath = `business/${businessId}`;
      const deleteFolderCloudinaryResult = await deleteFolderCloudinary(folderPath);

      if (deleteFolderCloudinaryResult !== true) {
        return reply.code(400).send({ message: deleteFolderCloudinaryResult });
      }

      return reply.code(200).send({ message: "Business deleted successfully" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Delete business failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });
};

