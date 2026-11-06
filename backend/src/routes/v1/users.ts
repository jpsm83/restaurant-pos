/**
 * Users Routes — self-service profile read/update.
 *
 * The profile update body is buffered and validated by the shared multipart
 * helper against the strict `updateUserBodySchema` from
 * `packages/schemas/user.ts`; the JSON-encoded `address` is parsed and validated
 * there. GET and PATCH are self-only: a person may read and edit only their own
 * client profile. The anonymous listing and creation routes are gone; self
 * sign-up is the only account-creation path.
 *
 * The read response is an explicit client whitelist plus a derived
 * `accountStatus` object: account creation, email-verification, privacy
 * acceptance, pending-email-change, verification-request, and credential
 * presence facts. The pending address, token values and expiries, Google
 * subject, password hash, and session counters are never returned.
 *
 * Account deletion is not registered. The two-phase pending-deletion
 * lifecycle, owned-Business resolution, reactivation, and grace window are
 * owned by build-order row 11.5. Every error is raised as an `AppError` so the
 * global handler emits RFC 9457 `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose from "mongoose";

import { createAuthHook } from "../../auth/middleware.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import { isCloudinaryAssetUrl } from "../../cloudinary/cloudinaryAsset.ts";
import User from "../../models/user.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  badRequest,
  forbidden,
  notFound,
  unauthorized,
} from "../../errors/appError.ts";
import { parseMultipart, type MultipartFile } from "../../schemas/multipart.ts";
import {
  SELF_PROFILE_READ_SELECTION,
  toSelfProfileResponse,
  type SelfProfileSource,
} from "../../users/selfProfile.ts";
import {
  updateUserBodySchema,
  userIdParamsSchema,
  type UpdateUserBody,
  type UserIdParams,
} from "restaurant-pos-packages/schemas/user";

/** Upload the single profile image, raising a `400` on any failure. */
async function uploadImage(
  folder: string,
  file: MultipartFile,
): Promise<string> {
  const response = await uploadFilesCloudinary({
    folder,
    filesArr: [{ buffer: file.buffer, mimeType: file.mimetype }],
    onlyImages: true,
  });

  if (
    typeof response === "string" ||
    response.length === 0 ||
    !response.every((str) => str.includes("https://"))
  ) {
    throw badRequest(`Error uploading image: ${response}`);
  }

  return response[0];
}

/**
 * Delete an image Project Imperium owns, refusing the request when the remote
 * delete fails. A provider-hosted or foreign URL is never ours to delete.
 */
async function deleteOwnedImage(imageUrl: string | undefined): Promise<void> {
  if (!imageUrl || !isCloudinaryAssetUrl(imageUrl)) return;

  const result = await deleteFilesCloudinary(imageUrl);
  if (result !== true) {
    throw badRequest(String(result));
  }
}

/** The multipart field name the profile image is sent under. */
const IMAGE_FIELD = "imageUrl";

/**
 * Exclusion projection for the profile-update response. The Google identity,
 * password, one-time tokens, session generation, notification/order pointers,
 * and soft-delete metadata stay server-owned and never leave this module.
 */
const CLIENT_PROFILE_PROJECTION = {
  googleId: 0,
  "personalDetails.password": 0,
  "personalDetails.emailVerified": 0,
  "personalDetails.imageSource": 0,
  "personalDetails.imageUpdatedAt": 0,
  verificationToken: 0,
  verificationTokenExpires: 0,
  verificationRequestedAt: 0,
  resetPasswordToken: 0,
  resetPasswordExpires: 0,
  resetPasswordRequestedAt: 0,
  pendingEmail: 0,
  pendingEmailToken: 0,
  pendingEmailExpires: 0,
  pendingEmailRequestedAt: 0,
  refreshSessionVersion: 0,
  notifications: 0,
  selfOrders: 0,
  deleted: 0,
  deletedAt: 0,
  deletedBy: 0,
} as const;

/** Whether the authenticated session belongs to this User. */
function assertSelf(
  req: { authSession?: { type: string; id: string } },
  userId: string,
): void {
  if (!req.authSession) {
    throw unauthorized("Authentication required");
  }
  if (req.authSession.type !== "user") {
    throw forbidden("User account required");
  }
  if (req.authSession.id !== userId) {
    throw forbidden("Forbidden");
  }
}

/** Set a field, clear it with `$unset`, or leave it alone when not sent. */
function applyProfileField(
  update: { set: Record<string, unknown>; unset: Record<string, ""> },
  path: string,
  value: unknown,
  stored?: unknown,
): void {
  if (value === undefined) return;
  if (value === null) {
    update.unset[path] = "";
    return;
  }
  if (value !== stored) update.set[path] = value;
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  // GET /users/:userId - the signed-in person's own profile
  app.get<{ Params: UserIdParams }>(
    "/:userId",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: userIdParamsSchema },
    },
    async (req, reply) => {
      const { userId } = req.params;
      assertSelf(req, userId);

      const user = await User.findOne(
        withSoftDeleteFilter({ _id: userId }),
        SELF_PROFILE_READ_SELECTION,
      ).lean<SelfProfileSource>();

      if (!user) {
        throw notFound("User not found!");
      }
      return reply.code(200).send(toSelfProfileResponse(user));
    },
  );

  // DELETE /users/:userId/image - remove the stored profile photo
  app.delete<{ Params: UserIdParams }>(
    "/:userId/image",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: userIdParamsSchema },
    },
    async (req, reply) => {
      const { userId } = req.params;
      assertSelf(req, userId);

      const userDoc = await User.findOne(
        withSoftDeleteFilter({ _id: userId }),
      ).lean();
      if (!userDoc) {
        throw notFound("User not found!");
      }

      const imageUrl = userDoc.personalDetails?.imageUrl;
      const hasAvatarState =
        Boolean(imageUrl) ||
        userDoc.personalDetails?.imageSource !== undefined;

      // Never recorded an avatar: leave the field provider-fillable rather
      // than marking a photo that never existed as removed.
      if (!hasAvatarState) {
        const currentUser = await User.findOne(
          withSoftDeleteFilter({ _id: userId }),
          CLIENT_PROFILE_PROJECTION,
        ).lean();

        if (!currentUser) {
          throw notFound("User not found!");
        }
        return reply.code(200).send({ user: currentUser });
      }

      await deleteOwnedImage(imageUrl);

      const updatedUser = await User.findOneAndUpdate(
        withSoftDeleteFilter({ _id: userId }),
        {
          $unset: { "personalDetails.imageUrl": "" },
          $set: {
            "personalDetails.imageSource": "removed",
            "personalDetails.imageUpdatedAt": new Date(),
          },
        },
        {
          returnDocument: "after",
          lean: true,
          projection: CLIENT_PROFILE_PROJECTION,
        },
      );

      if (!updatedUser) {
        throw notFound("User not found!");
      }

      return reply.code(200).send({ user: updatedUser });
    },
  );

  // PATCH /users/:userId - update own client profile (formData with optional image)
  app.patch<{ Params: UserIdParams }>(
    "/:userId",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: userIdParamsSchema },
    },
    async (req, reply) => {
      const { userId } = req.params;
      assertSelf(req, userId);

      const { fields, files } = await parseMultipart(req, updateUserBodySchema);

      const userDoc = await User.findOne(
        withSoftDeleteFilter({ _id: userId }),
      ).lean();
      if (!userDoc) {
        throw notFound("User not found!");
      }

      const update: {
        set: Record<string, unknown>;
        unset: Record<string, "">;
      } = { set: {}, unset: {} };
      const personalDetails = userDoc.personalDetails;

      applyProfileField(
        update,
        "personalDetails.username",
        fields.username,
        personalDetails.username,
      );
      applyProfileField(
        update,
        "personalDetails.firstName",
        fields.firstName,
        personalDetails.firstName,
      );
      applyProfileField(
        update,
        "personalDetails.lastName",
        fields.lastName,
        personalDetails.lastName,
      );
      applyProfileField(
        update,
        "personalDetails.phoneNumber",
        fields.phoneNumber,
        personalDetails.phoneNumber,
      );
      applyProfileField(
        update,
        "personalDetails.nationality",
        fields.nationality,
        personalDetails.nationality,
      );
      applyProfileField(
        update,
        "personalDetails.gender",
        fields.gender,
        personalDetails.gender,
      );

      if (fields.birthDate !== undefined) {
        if (fields.birthDate === null) {
          update.unset["personalDetails.birthDate"] = "";
        } else if (
          fields.birthDate.getTime() !== personalDetails.birthDate?.getTime()
        ) {
          update.set["personalDetails.birthDate"] = fields.birthDate;
        }
      }

      if (fields.address !== undefined) {
        if (fields.address === null) {
          update.unset["personalDetails.address"] = "";
        } else {
          update.set["personalDetails.address"] = fields.address;
        }
      }

      applyProfileField(
        update,
        "languagePreference",
        fields.languagePreference,
        userDoc.languagePreference,
      );

      applyProfileField(
        update,
        "themePreference",
        fields.themePreference,
        userDoc.themePreference,
      );

      const imageFile = files.find((file) => file.fieldname === IMAGE_FIELD);
      if (imageFile && imageFile.buffer.length > 0) {
        const imageUrl = await uploadImage(`/users/${userId}`, imageFile);

        await deleteOwnedImage(personalDetails.imageUrl);

        update.set["personalDetails.imageUrl"] = imageUrl;
        update.set["personalDetails.imageSource"] = "upload";
        update.set["personalDetails.imageUpdatedAt"] = new Date();
      }

      const updateQuery: mongoose.UpdateQuery<Record<string, unknown>> = {};
      if (Object.keys(update.set).length > 0) updateQuery.$set = update.set;
      if (Object.keys(update.unset).length > 0) updateQuery.$unset = update.unset;

      const updatedUser = await User.findOneAndUpdate(
        withSoftDeleteFilter({ _id: userId }),
        updateQuery,
        {
          returnDocument: "after",
          lean: true,
          projection: CLIENT_PROFILE_PROJECTION,
        },
      );

      if (!updatedUser) {
        throw notFound("User not found!");
      }

      return reply.code(200).send({
        message: "User updated successfully!",
        user: updatedUser,
      });
    },
  );

};
