import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import { compare, hash } from "bcrypt";
import dispatchEvent from "../../communications/dispatchEvent.ts";
import Business from "../../models/business.ts";
import BusinessGood from "../../models/businessGood.ts";
import DailySalesReport from "../../models/dailySalesReport.ts";
import Employee from "../../models/employee.ts";
import Inventory from "../../models/inventory.ts";
import MonthlyBusinessReport from "../../models/monthlyBusinessReport.ts";
import Notification from "../../models/notification.ts";
import Order from "../../models/order.ts";
import Printer from "../../models/printer.ts";
import Promotion from "../../models/promotion.ts";
import Purchase from "../../models/purchase.ts";
import Rating from "../../models/rating.ts";
import Reservation from "../../models/reservation.ts";
import SalesInstance from "../../models/salesInstance.ts";
import SalesPoint from "../../models/salesPoint.ts";
import Schedule from "../../models/schedule.ts";
import SupplierGood from "../../models/supplierGood.ts";
import Supplier from "../../models/supplier.ts";
import User from "../../models/user.ts";
import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import {
  createAuthHook,
  requireBusinessIdMatchesSessionHook,
  requireValidObjectIdParamHook,
} from "../../auth/middleware.ts";
import { issueSessionWithRefreshCookie } from "../../auth/issueSession.ts";
import type { AuthBusiness } from "../../auth/types.ts";
import {
  handleRequestEmailConfirmation,
  normalizeRequestEmail,
} from "../../auth/requestEmailConfirmation.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import deleteFolderCloudinary from "../../cloudinary/deleteFolderCloudinary.ts";
import objDefaultValidation from "../../../../packages/utils/objDefaultValidation.ts";
import type { ObjDefaultValidationType } from "../../../../packages/utils/objDefaultValidation.ts";
import {
  isValidPassword,
  PASSWORD_POLICY_MESSAGE,
} from "../../../../packages/utils/passwordPolicy.ts";
import * as enums from "../../../../packages/enums.ts";

/** Public JSON must omit password and auth-email secrets (see `TODO-auth-email-security-flows-implementation.md`). */
const BUSINESS_PUBLIC_LEAN_SELECT =
  "-password -emailVerificationTokenHash -passwordResetTokenHash -emailVerificationExpiresAt -passwordResetExpiresAt";

const {
  subscriptionEnums,
  currenctyEnums,
  foodSubCategoryEnums,
  cuisineTypeEnums,
} = enums;

function normalizeCuisineTypeForResponse(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function filterStringsByEnum(
  values: string[],
  allowed: readonly string[],
): string[] {
  const allow = new Set(allowed);
  return Array.from(new Set(values.filter((v) => allow.has(v))));
}

const DEFAULT_DISCOVERY_LIMIT = 50;

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];
const nonReqAddressFields = [
  "region",
  "doorNumber",
  "complement",
  "additionalDetails",
  "coordinates",
];

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

const flattenChangedFieldPaths = (
  value: unknown,
  prefix?: string,
): string[] => {
  if (Array.isArray(value)) {
    // Arrays are treated as one changed branch to keep notifications concise.
    return prefix ? [prefix] : [];
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return prefix ? [prefix] : [];

    const nested = entries.flatMap(([key, nestedValue]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return flattenChangedFieldPaths(nestedValue, path);
    });

    return nested.length > 0 ? nested : prefix ? [prefix] : [];
  }

  return prefix ? [prefix] : [];
};

function haversineKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
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
      businesses = await Business.find()
        .select(BUSINESS_PUBLIC_LEAN_SELECT)
        .lean();
    } else {
      const filter: Record<string, unknown> = {};

      if (cuisineType) {
        filter.cuisineType = { $in: [cuisineType] };
      }

      if (categoriesParam) {
        const categories = categoriesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const allowed = filterStringsByEnum(categories, foodSubCategoryEnums);
        if (allowed.length > 0) filter.categories = { $in: allowed };
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
            100,
          )
        : DEFAULT_DISCOVERY_LIMIT;

      businesses = await Business.find(filter)
        .select(BUSINESS_PUBLIC_LEAN_SELECT)
        .limit(limit)
        .lean();
    }

    if (
      latParam !== undefined &&
      lngParam !== undefined &&
      businesses.length > 0
    ) {
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
            b.address.coordinates.length >= 2,
        );
        const withDistance = withCoords.map((b) => {
          const [lon, coordLat] = (
            b.address as { coordinates: [number, number] }
          ).coordinates;
          const km = haversineKm(lng, lat, lon, coordLat);
          return { ...b, _distanceKm: km };
        });
        const filtered =
          radiusKm !== null && !Number.isNaN(radiusKm)
            ? withDistance.filter(
                (b) => (b as { _distanceKm: number })._distanceKm <= radiusKm,
              )
            : withDistance;
        const sorted = [...filtered].sort(
          (a, b) =>
            (a as { _distanceKm: number })._distanceKm -
            (b as { _distanceKm: number })._distanceKm,
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

    const business = await Business.findById(businessId)
      .select(BUSINESS_PUBLIC_LEAN_SELECT)
      .lean();

    if (!business) {
      return reply.code(404).send({ message: "No business found!" });
    }

    const payload = {
      ...business,
      cuisineType: normalizeCuisineTypeForResponse(
        (business as Record<string, unknown>).cuisineType,
      ),
    };

    return reply.code(200).send(payload);
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
    const deliveryOpeningWindowsStr =
      fields.deliveryOpeningWindows || undefined;

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

    const registrationEmail = normalizeRequestEmail(email);

    if (!isValidPassword(password)) {
      return reply.code(400).send({ message: PASSWORD_POLICY_MESSAGE });
    }

    const addressValidationResult = (
      objDefaultValidation as unknown as ObjDefaultValidationType
    )(address as object, reqAddressFields, nonReqAddressFields);
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
      $or: [{ legalName }, { email: registrationEmail }, { taxNumber }],
    });
    if (duplicateBusiness) {
      return reply.code(409).send({
        message: `Business ${legalName}, ${registrationEmail} or ${taxNumber} already exists!`,
      });
    }

    const hashedPassword = await hash(password, 10);
    const businessId = new Types.ObjectId();

    const newBusiness: Record<string, unknown> = {
      _id: businessId,
      tradeName,
      legalName,
      email: registrationEmail,
      password: hashedPassword,
      phoneNumber,
      taxNumber,
      currencyTrade,
      subscription,
      address,
      contactPerson: contactPerson || undefined,
    };

    if (cuisineType) {
      const raw = String(cuisineType).trim();
      try {
        if (raw.startsWith("[")) {
          const parsed = JSON.parse(raw) as unknown;
          if (
            Array.isArray(parsed) &&
            parsed.every((x) => typeof x === "string")
          ) {
            newBusiness.cuisineType = filterStringsByEnum(
              parsed.map((s) => String(s).trim()).filter(Boolean),
              cuisineTypeEnums,
            );
          }
        } else if ((cuisineTypeEnums as readonly string[]).includes(raw)) {
          newBusiness.cuisineType = [raw];
        }
      } catch {
        // ignore invalid JSON
      }
    }

    if (categoriesStr) {
      try {
        const parsed = JSON.parse(categoriesStr) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.every((x) => typeof x === "string")
        ) {
          newBusiness.categories = filterStringsByEnum(
            parsed.map((s) => String(s).trim()).filter(Boolean),
            foodSubCategoryEnums,
          );
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

    const session: AuthBusiness = {
      id: String(businessId),
      email: registrationEmail,
      type: "business",
      emailVerified: false,
    };
    const { accessToken, user } = issueSessionWithRefreshCookie(
      app,
      reply,
      session,
      { refreshSessionVersion: 0 },
    );

    // Phase 4.2: confirmation email (non-blocking; session unchanged).
    handleRequestEmailConfirmation(registrationEmail)
      .then((result) => {
        if (result.kind === "server_error_500") {
          req.log.error(
            { errHint: "business_registration_confirmation_send" },
            result.message,
          );
        }
      })
      .catch((err) => {
        req.log.error({ err }, "Business registration confirmation email failed");
      });

    return reply.code(201).send({
      message: `Business ${legalName} created`,
      accessToken,
      user,
    });
  });

  app.patch(
    "/:businessId",
    {
      preValidation: [
        requireValidObjectIdParamHook("businessId"),
        createAuthHook(app),
        requireBusinessIdMatchesSessionHook(),
      ],
    },
    async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId!;

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
    const categoriesStr = fields.categories || undefined;
    const averageRatingStr = fields.averageRating || undefined;
    const ratingCountStr = fields.ratingCount || undefined;
    const acceptsDeliveryStr = fields.acceptsDelivery || undefined;
    const deliveryRadiusStr = fields.deliveryRadius || undefined;
    const minOrderStr = fields.minOrder || undefined;
    const businessOpeningHoursStr = fields.businessOpeningHours || undefined;
    const deliveryOpeningWindowsStr =
      fields.deliveryOpeningWindows || undefined;

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

    if (password && !isValidPassword(password)) {
      return reply.code(400).send({ message: PASSWORD_POLICY_MESSAGE });
    }

    const addressValidationResult = (
      objDefaultValidation as unknown as ObjDefaultValidationType
    )(address as object, reqAddressFields, nonReqAddressFields);
    if (addressValidationResult !== true) {
      return reply.code(400).send({ message: addressValidationResult });
    }

    if (metrics) {
      const metricsValidationResult = (
        objDefaultValidation as unknown as ObjDefaultValidationType
      )(metrics as object, reqMetrics, []);
      if (metricsValidationResult !== true) {
        return reply.code(400).send({ message: metricsValidationResult });
      }

      const supplierGoodWastePercentageValidationResult = (
        objDefaultValidation as unknown as ObjDefaultValidationType
      )(
        metrics.supplierGoodWastePercentage as object,
        reqSupplierGoodWastePercentage,
        [],
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
        if (
          !Array.isArray(parsed) ||
          !parsed.every((x) => typeof x === "string")
        ) {
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

    if (password) {
      const currentPasswordRaw = String(fields.currentPassword ?? "").trim();
      if (!currentPasswordRaw) {
        return reply.code(400).send({
          message: "Current password is required to set a new sign-in password.",
        });
      }
      const storedHash = (business as Record<string, unknown>).password as
        | string
        | undefined;
      if (!storedHash) {
        return reply
          .code(500)
          .send({ message: "Business password state is invalid." });
      }
      const passwordOk = await compare(currentPasswordRaw, storedHash);
      if (!passwordOk) {
        return reply.code(401).send({ message: "Current password is incorrect." });
      }
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
    if (Object.prototype.hasOwnProperty.call(fields, "contactPerson")) {
      const cp = String(fields.contactPerson ?? "").trim();
      const prev = String(
        (business as Record<string, unknown>).contactPerson ?? "",
      ).trim();
      const next = cp.length > 0 ? cp : null;
      const prevNorm = prev.length > 0 ? prev : null;
      if (next !== prevNorm) {
        updateBusinessObj.contactPerson = next;
      }
    }

    if (Object.prototype.hasOwnProperty.call(fields, "cuisineType")) {
      const raw = String(fields.cuisineType ?? "").trim();
      let next: string[];
      if (raw === "" || raw === "[]") {
        next = [];
      } else {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (
            !Array.isArray(parsed) ||
            !parsed.every((x) => typeof x === "string")
          ) {
            return reply.code(400).send({
              message: "cuisineType must be a JSON array of strings!",
            });
          }
          next = filterStringsByEnum(
            parsed.map((s) => String(s).trim()).filter(Boolean),
            cuisineTypeEnums,
          );
        } catch {
          return reply.code(400).send({
            message: "cuisineType must be a valid JSON array of strings!",
          });
        }
      }
      updateBusinessObj.cuisineType = next;
    }

    if (categoriesStr !== undefined) {
      try {
        const parsed = JSON.parse(categoriesStr) as unknown;
        if (
          !Array.isArray(parsed) ||
          !parsed.every((x) => typeof x === "string")
        ) {
          return reply.code(400).send({
            message: "categories must be an array of strings!",
          });
        }
        updateBusinessObj.categories = filterStringsByEnum(
          parsed.map((s) => String(s).trim()).filter(Boolean),
          foodSubCategoryEnums,
        );
      } catch {
        return reply.code(400).send({
          message: "categories must be a valid JSON array of strings!",
        });
      }
    }
    if (averageRatingStr !== undefined && averageRatingStr !== "") {
      const n = Number(averageRatingStr);
      if (!Number.isNaN(n) && n >= 0 && n <= 5)
        updateBusinessObj.averageRating = n;
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
          const metricsSupplierWaste =
            metrics.supplierGoodWastePercentage as Record<string, unknown>;
          const businessSupplierWaste =
            (businessMetrics?.supplierGoodWastePercentage || {}) as Record<
              string,
              unknown
            >;
          for (const [wKey, wValue] of Object.entries(metricsSupplierWaste)) {
            if (wValue !== businessSupplierWaste[wKey]) {
              updatedSupplierGoodWastePercentage[wKey] = wValue;
            }
          }
        }
      }
      if (Object.keys(updatedSupplierGoodWastePercentage).length > 0)
        updatedMetrics.supplierGoodWastePercentage =
          updatedSupplierGoodWastePercentage;
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

      const existingImageUrl = (business as Record<string, unknown>)
        .imageUrl as string | undefined;
      const deleteFilesCloudinaryResult =
        await deleteFilesCloudinary(existingImageUrl);

      if (deleteFilesCloudinaryResult !== true) {
        return reply.code(400).send({ message: deleteFilesCloudinaryResult });
      }

      updateBusinessObj.imageUrl = cloudinaryUploadResponse[0];
    }

    if (password) {
      updateBusinessObj.password = await hash(password, 10);
    }

    const updateOps: mongoose.UpdateQuery<Record<string, unknown>> = {
      $set: updateBusinessObj,
    };
    if (password) {
      updateOps.$inc = { refreshSessionVersion: 1 };
    }

    const updatedBusiness = await Business.findByIdAndUpdate(
      businessId,
      updateOps,
      { new: true, lean: true },
    );

    if (!updatedBusiness) {
      return reply.code(404).send({ message: "Business to update not found!" });
    }

    const changedFields = flattenChangedFieldPaths(updateBusinessObj);
    if (changedFields.length > 0) {
      const authSession = req.authSession;
      const correlationIdHeader = req.headers["x-correlation-id"];
      const operationIdHeader = req.headers["x-idempotency-key"];
      const correlationId =
        typeof correlationIdHeader === "string"
          ? correlationIdHeader
          : undefined;
      const operationId =
        typeof operationIdHeader === "string" ? operationIdHeader : undefined;

      // Fail-soft dispatch: persistence and API response remain successful even if
      // communications channels fail. This keeps profile updates non-blocking.
      dispatchEvent(
        "BUSINESS_PROFILE_UPDATED",
        {
          businessId: new Types.ObjectId(businessId),
          actor: {
            source: authSession?.type === "business" ? "businessOwner" : "system",
            email: authSession?.email,
          },
          changedFields,
          changedFieldCount: changedFields.length,
          occurredAt: new Date(),
          context: {
            correlationId,
            operationId,
            requestPath: req.routeOptions.url,
            requestMethod: req.method,
          },
        },
        {
          fireAndForget: true,
          correlationId,
          idempotencyKey: operationId,
        },
      ).catch((error: unknown) => {
        req.log.warn(
          {
            scope: "business.profileUpdate.dispatch",
            businessId,
            changedFieldCount: changedFields.length,
            error:
              error instanceof Error
                ? error.message
                : "Unknown dispatch error",
          },
          "BUSINESS_PROFILE_UPDATED dispatch failed (fail-soft)",
        );
      });
    }

    const session: AuthBusiness = {
      id: String(updatedBusiness._id),
      email: updatedBusiness.email,
      type: "business",
      emailVerified: updatedBusiness.emailVerified === true,
    };
    const { accessToken, user } = issueSessionWithRefreshCookie(
      app,
      reply,
      session,
      {
        refreshSessionVersion:
          (updatedBusiness as { refreshSessionVersion?: number })
            .refreshSessionVersion ?? 0,
      },
    );

    return reply.code(200).send({
      message: "Business updated successfully",
      accessToken,
      user,
    });
  },
  );

  app.delete("/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid businessId!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Sequential writes: MongoDB does not support concurrent use of one session.
      await Business.deleteOne({ _id: businessId }, { session });
      await BusinessGood.deleteMany({ businessId }, { session });
      await DailySalesReport.deleteMany({ businessId }, { session });
      await Employee.deleteMany({ businessId }, { session });
      await Inventory.deleteMany({ businessId }, { session });
      await MonthlyBusinessReport.deleteMany({ businessId }, { session });
      await Notification.deleteMany({ businessId }, { session });
      await Order.deleteMany({ businessId }, { session });
      await Printer.deleteMany({ businessId }, { session });
      await Promotion.deleteMany({ businessId }, { session });
      await Purchase.deleteMany({ businessId }, { session });
      await Rating.deleteMany({ businessId }, { session });
      await Reservation.deleteMany({ businessId }, { session });
      await SalesInstance.deleteMany({ businessId }, { session });
      await SalesPoint.deleteMany({ businessId }, { session });
      await Schedule.deleteMany({ businessId }, { session });
      await SupplierGood.deleteMany({ businessId }, { session });
      await Supplier.deleteMany({ businessId }, { session });
      await User.deleteMany({ businessId }, { session });

      await session.commitTransaction();

      const folderPath = `business/${businessId}`;
      const deleteFolderCloudinaryResult =
        await deleteFolderCloudinary(folderPath);

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
