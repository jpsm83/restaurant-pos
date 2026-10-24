/**
 * Business Routes — business discovery, registration, profile update and delete.
 *
 * Multipart bodies (registration and profile update) are buffered and validated
 * by the shared multipart helper against strict zod DTOs from
 * `packages/schemas/business.ts`; JSON-encoded fields (`address`,
 * `businessOpeningHours`, `deliveryOpeningWindows`, `metrics`,
 * `reportingConfig`) are parsed and validated there. The GET/DELETE path params
 * and the discovery query are validated by their DTOs. Every error is raised as
 * an `AppError` so the global handler emits RFC 9457 `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import { hash } from "bcrypt";
import dispatchEvent from "../../communications/dispatchEvent.ts";
import Business from "../../models/business.ts";
import Employee from "../../models/employee.ts";
import Notification from "../../models/notification.ts";
import User from "../../models/user.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  createAuthHook,
  createOptionalAuthHook,
  requireBusinessIdMatchesSessionHook,
} from "../../auth/middleware.ts";
import { issueSessionWithRefreshCookie } from "../../auth/issueSession.ts";
import type { AuthBusiness } from "../../auth/types.ts";
import { handleRequestEmailConfirmation } from "../../auth/requestEmailConfirmation.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import {
  badRequest,
  conflict,
  notFound,
} from "../../errors/appError.ts";
import { parseMultipart } from "../../schemas/multipart.ts";
import {
  isSupportedTimezone,
  timezoneSchema,
} from "restaurant-pos-packages/schemas";
import {
  businessIdParamsSchema,
  createBusinessBodySchema,
  discoverBusinessesQuerySchema,
  businessIncludeDeletedQuerySchema,
  updateBusinessBodySchema,
  type BusinessIncludeDeletedQuery,
  type BusinessIdParams,
  type DiscoverBusinessesQuery,
} from "restaurant-pos-packages/schemas/business";
import type {
  IBusiness,
  IReportingConfig,
} from "restaurant-pos-packages/interfaces/IBusiness";
import { foodSubCategoryEnums } from "restaurant-pos-packages/enums";
import {
  resolveTimezoneFromAddress,
  type AddressLike,
} from "restaurant-pos-packages/utils/timezoneFromAddress";

/** Public JSON must omit password and auth-email secrets (see `TODO-auth-email-security-flows-implementation.md`). */
const BUSINESS_PUBLIC_LEAN_SELECT =
  "-password -verificationToken -resetPasswordToken -resetPasswordExpires -pendingEmail -pendingEmailToken -pendingEmailExpires -pendingEmailRequestedAt";

const DEFAULT_DISCOVERY_LIMIT = 50;

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

/**
 * Derive the business timezone from its address and validate it with the one
 * canonical rule, so only zones the platform supports are ever stored.
 * Addresses that cannot be mapped yield `undefined`; reads then fall back to UTC.
 */
function deriveStoredTimezone(address: AddressLike): string | undefined {
  const parsed = timezoneSchema.safeParse(resolveTimezoneFromAddress(address));
  return parsed.success ? parsed.data : undefined;
}

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
  app.get<{ Querystring: DiscoverBusinessesQuery }>(
    "/",
    { schema: { querystring: discoverBusinessesQuerySchema } },
    async (req, reply) => {
      const query = req.query;

      const cuisineType = query.cuisineType;
      const categoriesParam = query.categories;
      const name = query.name ?? query.tradeName;
      const minRating = query.rating ?? query.minRating;
      const { lat, lng, radius } = query;

      const hasFilters =
        cuisineType !== undefined ||
        categoriesParam !== undefined ||
        name !== undefined ||
        minRating !== undefined ||
        (lat !== undefined && lng !== undefined);

      let businesses: unknown[];

      if (!hasFilters) {
        businesses = await Business.find(
          withSoftDeleteFilter({}, query.includeDeleted ?? false),
        )
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

        if (minRating !== undefined) {
          filter.averageRating = { $gte: minRating };
          filter.ratingCount = { $gte: 1 };
        }

        const limit = query.limit ?? DEFAULT_DISCOVERY_LIMIT;

        businesses = await Business.find(
          withSoftDeleteFilter(filter as Record<string, unknown>, query.includeDeleted ?? false),
        )
          .select(BUSINESS_PUBLIC_LEAN_SELECT)
          .limit(limit)
          .lean();
      }

      if (lat !== undefined && lng !== undefined && businesses.length > 0) {
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
          radius !== undefined
            ? withDistance.filter(
                (b) => (b as { _distanceKm: number })._distanceKm <= radius,
              )
            : withDistance;
        const sorted = [...filtered].sort(
          (a, b) =>
            (a as { _distanceKm: number })._distanceKm -
            (b as { _distanceKm: number })._distanceKm,
        );
        businesses = sorted.map(({ _distanceKm, ...rest }) => rest);
      }

      if (!businesses.length) {
        throw badRequest("No business found!");
      }

      return reply.code(200).send(businesses);
    },
  );

  app.get<{
    Params: BusinessIdParams;
    Querystring: BusinessIncludeDeletedQuery;
  }>(
    "/:businessId",
    {
      preValidation: [createAuthHook(app)],
      preHandler: [requireBusinessIdMatchesSessionHook()],
      schema: {
        params: businessIdParamsSchema,
        querystring: businessIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      const business = await Business.findOne(
        withSoftDeleteFilter({ _id: businessId }, includeDeleted),
      )
        .select(BUSINESS_PUBLIC_LEAN_SELECT)
        .lean();

      if (!business) {
        throw notFound("No business found!");
      }

      const storedTimezone = (business as Record<string, unknown>).timezone;
      const timezoneIsDefault = !isSupportedTimezone(storedTimezone);
      const payload = {
        ...business,
        cuisineType: normalizeCuisineTypeForResponse(
          (business as Record<string, unknown>).cuisineType,
        ),
        timezone: timezoneIsDefault ? "UTC" : storedTimezone,
        timezoneIsDefault,
      };

      return reply.code(200).send(payload);
    },
  );

  app.post("/", async (req, reply) => {
    const { fields, files } = await parseMultipart(req, createBusinessBodySchema);

    // An office email is not a unique sign-in identity.
    const duplicateBusiness = await Business.exists(
      withSoftDeleteFilter({
        $or: [
          { legalName: fields.legalName },
          { taxNumber: fields.taxNumber },
        ],
      }),
    );
    if (duplicateBusiness) {
      throw conflict("Business legal name or tax number already exists!");
    }

    const hashedPassword = await hash(fields.password, 10);
    const businessId = new Types.ObjectId();

    const newBusiness: Record<string, unknown> = {
      _id: businessId,
      tradeName: fields.tradeName,
      legalName: fields.legalName,
      email: fields.email,
      password: hashedPassword,
      phoneNumber: fields.phoneNumber,
      taxNumber: fields.taxNumber,
      currencyTrade: fields.currencyTrade,
      subscription: fields.subscription,
      timezone: deriveStoredTimezone(fields.address),
      address: fields.address,
    };

    if (fields.contactPerson) newBusiness.contactPerson = fields.contactPerson;
    if (fields.cuisineType !== undefined)
      newBusiness.cuisineType = fields.cuisineType;
    if (fields.categories !== undefined)
      newBusiness.categories = fields.categories;
    if (fields.acceptsDelivery !== undefined)
      newBusiness.acceptsDelivery = fields.acceptsDelivery;
    if (fields.deliveryRadius !== undefined)
      newBusiness.deliveryRadius = fields.deliveryRadius;
    if (fields.minOrder !== undefined) newBusiness.minOrder = fields.minOrder;
    if (fields.businessOpeningHours !== undefined)
      newBusiness.businessOpeningHours = fields.businessOpeningHours;
    if (fields.deliveryOpeningWindows !== undefined)
      newBusiness.deliveryOpeningWindows = fields.deliveryOpeningWindows;

    const imageFile = files.find((file) => file.fieldname === "imageUrl");
    if (imageFile && imageFile.buffer.length > 0) {
      const folder = `/business/${businessId}`;
      const uploaded = await uploadFilesCloudinary({
        folder,
        filesArr: [{ buffer: imageFile.buffer, mimeType: imageFile.mimetype }],
        onlyImages: true,
      });

      if (
        typeof uploaded === "string" ||
        uploaded.length === 0 ||
        !uploaded.every((url) => url.includes("https://"))
      ) {
        throw badRequest(`Error uploading image: ${uploaded}`);
      }

      newBusiness.imageUrl = uploaded[0];
    }

    await Business.create(newBusiness);

    const session: AuthBusiness = {
      id: String(businessId),
      email: fields.email,
      type: "business",
      emailVerified: false,
      role: "Tenant",
    };
    const { accessToken, user } = await issueSessionWithRefreshCookie(
      app,
      reply,
      session,
      { refreshSessionVersion: 0 },
    );

    // Phase 4.2: confirmation email (non-blocking; session unchanged).
    handleRequestEmailConfirmation(fields.email)
      .then((result) => {
        if (
          result.kind === "server_error_500" ||
          result.kind === "already_verified_400"
        ) {
          req.log.error(
            { errHint: "business_registration_confirmation_send" },
            result.message,
          );
        }
      })
      .catch((err) => {
        req.log.error(
          { err },
          "Business registration confirmation email failed",
        );
      });

    return reply.code(201).send({
      message: `Business ${fields.legalName} created`,
      accessToken,
      user,
    });
  });

  app.patch<{ Params: BusinessIdParams }>(
    "/:businessId",
    {
      preValidation: [createAuthHook(app)],
      preHandler: [requireBusinessIdMatchesSessionHook()],
      schema: { params: businessIdParamsSchema },
    },
    async (req, reply) => {
      const businessId = req.params.businessId;

      const { fields, files } = await parseMultipart(
        req,
        updateBusinessBodySchema,
      );

      const duplicateBusiness = await Business.exists({
        ...withSoftDeleteFilter({
          _id: { $ne: businessId },
          $or: [
            { legalName: fields.legalName },
            { taxNumber: fields.taxNumber },
          ],
        }),
      });
      if (duplicateBusiness) {
        throw conflict("Business legal name or tax number already exists!");
      }

      const business = await Business.findOne(
        withSoftDeleteFilter({ _id: businessId }),
      ).lean();
      if (!business) {
        throw notFound("Business not found!");
      }

      const businessRecord = business as Record<string, unknown>;

      const updateBusinessObj: Record<string, unknown> = {};

      if (fields.tradeName !== businessRecord.tradeName)
        updateBusinessObj.tradeName = fields.tradeName;
      if (fields.legalName !== businessRecord.legalName)
        updateBusinessObj.legalName = fields.legalName;
      if (fields.phoneNumber !== businessRecord.phoneNumber)
        updateBusinessObj.phoneNumber = fields.phoneNumber;
      if (fields.taxNumber !== businessRecord.taxNumber)
        updateBusinessObj.taxNumber = fields.taxNumber;
      if (fields.currencyTrade !== businessRecord.currencyTrade)
        updateBusinessObj.currencyTrade = fields.currencyTrade;
      if (fields.subscription !== businessRecord.subscription)
        updateBusinessObj.subscription = fields.subscription;

      if (fields.contactPerson !== undefined) {
        const next = fields.contactPerson.length > 0 ? fields.contactPerson : null;
        const prev = String(businessRecord.contactPerson ?? "").trim();
        const prevNorm = prev.length > 0 ? prev : null;
        if (next !== prevNorm) {
          updateBusinessObj.contactPerson = next;
        }
      }

      if (fields.cuisineType !== undefined) {
        updateBusinessObj.cuisineType = fields.cuisineType;
      }

      if (fields.categories !== undefined) {
        updateBusinessObj.categories = fields.categories;
      }

      if (fields.acceptsDelivery !== undefined) {
        updateBusinessObj.acceptsDelivery = fields.acceptsDelivery;
      }

      if (fields.deliveryRadius !== undefined) {
        updateBusinessObj.deliveryRadius = fields.deliveryRadius;
      }

      if (fields.minOrder !== undefined) {
        updateBusinessObj.minOrder = fields.minOrder;
      }

      if (fields.businessOpeningHours !== undefined) {
        updateBusinessObj.businessOpeningHours = fields.businessOpeningHours;
      }

      if (fields.deliveryOpeningWindows !== undefined) {
        updateBusinessObj.deliveryOpeningWindows = fields.deliveryOpeningWindows;
      }

      const businessAddress = businessRecord.address as
        | Record<string, unknown>
        | undefined;
      const address = fields.address;
      // Dotted `$set` paths preserve address fields not sent in this request.
      let addressChanged = false;
      for (const [key, value] of Object.entries(address)) {
        if (value !== businessAddress?.[key]) {
          updateBusinessObj[`address.${key}`] = value;
          addressChanged = true;
        }
      }

      // Keep the derived timezone in sync with the (possibly changed) address.
      const resolvedTimezone = deriveStoredTimezone({
        ...(businessAddress ?? {}),
        ...address,
      });
      const storedTimezone = businessRecord.timezone;
      let clearTimezone = false;
      if (resolvedTimezone !== undefined) {
        if (resolvedTimezone !== storedTimezone)
          updateBusinessObj.timezone = resolvedTimezone;
      } else if (addressChanged && storedTimezone !== undefined) {
        // The address moved somewhere we cannot map: drop the stale zone so the
        // profile read falls back to UTC with `timezoneIsDefault`.
        clearTimezone = true;
      }

      if (fields.metrics) {
        const businessMetrics = businessRecord.metrics as
          | Record<string, unknown>
          | undefined;
        const businessSupplierWaste = (businessMetrics
          ?.supplierGoodWastePercentage || {}) as Record<string, unknown>;

        // Dotted `$set` paths preserve metrics not sent in this request.
        for (const [key, value] of Object.entries(fields.metrics)) {
          if (key !== "supplierGoodWastePercentage") {
            if (value !== businessMetrics?.[key]) {
              updateBusinessObj[`metrics.${key}`] = value;
            }
          } else {
            const metricsSupplierWaste = value as Record<string, unknown>;
            for (const [wKey, wValue] of Object.entries(metricsSupplierWaste)) {
              if (wValue !== businessSupplierWaste[wKey]) {
                updateBusinessObj[
                  `metrics.supplierGoodWastePercentage.${wKey}`
                ] = wValue;
              }
            }
          }
        }
      }

      if (fields.reportingConfig !== undefined) {
        const previousReportingConfig = businessRecord.reportingConfig as
          | Partial<IReportingConfig>
          | undefined;
        if (
          previousReportingConfig?.weeklyReportStartDay !==
          fields.reportingConfig.weeklyReportStartDay
        ) {
          updateBusinessObj.reportingConfig = fields.reportingConfig;
        }
      }

      const imageFile = files.find((file) => file.fieldname === "imageUrl");
      if (imageFile && imageFile.buffer.length > 0) {
        const folder = `/business/${businessId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: [{ buffer: imageFile.buffer, mimeType: imageFile.mimetype }],
          onlyImages: true,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every((str) => str.includes("https://"))
        ) {
          throw badRequest(
            `Error uploading image: ${cloudinaryUploadResponse}`,
          );
        }

        const existingImageUrl = businessRecord.imageUrl as string | undefined;
        const deleteFilesCloudinaryResult =
          await deleteFilesCloudinary(existingImageUrl);

        if (deleteFilesCloudinaryResult !== true) {
          throw badRequest(
            typeof deleteFilesCloudinaryResult === "string"
              ? deleteFilesCloudinaryResult
              : "DeleteCloudinaryImage failed!",
          );
        }

        updateBusinessObj.imageUrl = cloudinaryUploadResponse[0];
      }

      const updateOps: mongoose.UpdateQuery<Record<string, unknown>> = {
        $set: updateBusinessObj,
      };
      if (clearTimezone) {
        updateOps.$unset = { timezone: 1 };
      }

      const updatedBusiness = await Business.findOneAndUpdate(
        withSoftDeleteFilter({ _id: businessId }),
        updateOps,
        { returnDocument: "after", lean: true },
      );

      if (!updatedBusiness) {
        throw notFound("Business to update not found!");
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
              source:
                authSession?.type === "business" ? "businessOwner" : "system",
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
        role: "Tenant",
      };
      const { accessToken, user } = await issueSessionWithRefreshCookie(
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

  app.delete<{ Params: BusinessIdParams }>(
    "/:businessId",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: { params: businessIdParamsSchema },
    },
    async (req, reply) => {
      const { businessId } = req.params;

      const business = await Business.findById(businessId)
        .setOptions({ includeDeleted: true })
        .select("deleted")
        .lean();
      if (!business) {
        throw notFound("Business not found!");
      }
      if (business.deleted) {
        throw conflict("Business already deleted!");
      }

      const wasDeleted = await markAsDeletedById(
        Business as mongoose.Model<IBusiness & { deleted: boolean }>,
        businessId,
        { deletedBy: req.authSession?.id },
      );
      if (!wasDeleted) {
        throw conflict("Business already deleted!");
      }

      return reply.code(200).send({ message: "Business deleted successfully" });
    },
  );
};
