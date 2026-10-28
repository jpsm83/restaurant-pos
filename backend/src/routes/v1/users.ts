/**
 * Users Routes — self-service profile read/update, account deletion, and
 * notification read/deleted flags.
 *
 * The profile update body is buffered and validated by the shared multipart
 * helper against the strict `updateUserBodySchema` from
 * `packages/schemas/user.ts`; the JSON-encoded `address` is parsed and validated
 * there. GET and PATCH are self-only: a person may read and edit only their own
 * client profile. The anonymous listing and creation routes are gone; self
 * sign-up is the only account-creation path. Every error is raised as an
 * `AppError` so the global handler emits RFC 9457 `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose from "mongoose";
import type { IUser } from "restaurant-pos-packages/interfaces/IUser";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";

import { createOptionalAuthHook } from "../../auth/middleware.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import User from "../../models/user.ts";
import Employee from "../../models/employee.ts";
import Notification from "../../models/notification.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../../errors/appError.ts";
import { parseMultipart, type MultipartFile } from "../../schemas/multipart.ts";
import {
  markNotificationDeletedBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userNotificationParamsSchema,
  type MarkNotificationDeletedBody,
  type UpdateUserBody,
  type UserIdParams,
  type UserNotificationParams,
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

/** The multipart field name the profile image is sent under. */
const IMAGE_FIELD = "imageUrl";

/**
 * Fields the client profile read/write returns. The password, one-time tokens,
 * session generation, notification/order pointers, and soft-delete metadata
 * stay server-owned and never leave this module.
 */
const CLIENT_PROFILE_PROJECTION = {
  "personalDetails.password": 0,
  "personalDetails.emailVerified": 0,
  verificationToken: 0,
  resetPasswordToken: 0,
  resetPasswordExpires: 0,
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
      preValidation: [createOptionalAuthHook(app)],
      schema: { params: userIdParamsSchema },
    },
    async (req, reply) => {
      const { userId } = req.params;
      assertSelf(req, userId);

      const user = await User.findOne(
        withSoftDeleteFilter({ _id: userId }),
        CLIENT_PROFILE_PROJECTION,
      ).lean();

      if (!user) {
        throw notFound("User not found!");
      }
      return reply.code(200).send(user);
    },
  );

  // PATCH /users/:userId - update own client profile (formData with optional image)
  app.patch<{ Params: UserIdParams }>(
    "/:userId",
    {
      preValidation: [createOptionalAuthHook(app)],
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

      const imageFile = files.find((file) => file.fieldname === IMAGE_FIELD);
      if (imageFile && imageFile.buffer.length > 0) {
        const imageUrl = await uploadImage(`/users/${userId}`, imageFile);

        const deleteFilesCloudinaryResult = await deleteFilesCloudinary(
          personalDetails.imageUrl || "",
        );

        if (deleteFilesCloudinaryResult !== true) {
          throw badRequest(String(deleteFilesCloudinaryResult));
        }

        update.set["personalDetails.imageUrl"] = imageUrl;
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

  // DELETE /users/:userId - delete
  app.delete<{ Params: UserIdParams }>(
    "/:userId",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: { params: userIdParamsSchema },
    },
    async (req, reply) => {
      const { userId } = req.params;

      const employee = (await Employee.findOne({ userId })
        .select("terminatedDate")
        .lean()) as IEmployee | null;

      if (employee?.terminatedDate) {
        throw badRequest(
          "User cannot be deleted because he/she is employeed!",
        );
      }

      const user = await User.findById(userId)
        .setOptions({ includeDeleted: true })
        .select("deleted")
        .lean();
      if (!user) {
        throw notFound("User not found!");
      }
      if (user.deleted) {
        throw conflict("User already deleted!");
      }

      const wasDeleted = await markAsDeletedById(
        User as mongoose.Model<IUser & { deleted: boolean }>,
        userId,
        { deletedBy: req.authSession?.id },
      );
      if (!wasDeleted) {
        throw conflict("User already deleted!");
      }

      return reply.code(200).send({ message: "User deleted successfully" });
    },
  );

  // PATCH /users/:userId/markNotificationAsDeleted - mark notification deleted (transaction)
  app.patch<{ Params: UserIdParams; Body: MarkNotificationDeletedBody }>(
    "/:userId/markNotificationAsDeleted",
    {
      schema: {
        params: userIdParamsSchema,
        body: markNotificationDeletedBodySchema,
      },
    },
    async (req, reply) => {
      const { userId } = req.params;
      const { notificationId } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const notificationExists = await Notification.exists({
          _id: notificationId,
        }).session(session);

        if (!notificationExists) {
          throw notFound("Notification not found!");
        }

        const updatedUser = await User.findOneAndUpdate(
          withSoftDeleteFilter({
            _id: userId,
            "notifications.notificationId": notificationId,
          }),
          {
            $set: {
              "notifications.$.deletedFlag": true,
              "notifications.$.readFlag": true,
            },
          },
          { returnDocument: "after", lean: true, session },
        );

        if (!updatedUser) {
          throw notFound("User not found!");
        }

        await session.commitTransaction();

        return reply.code(200).send({
          message: "User notification mark as deleted successfully!",
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // PATCH /users/:userId/updateReadFlag/:notificationId - update read flag
  app.patch<{ Params: UserNotificationParams }>(
    "/:userId/updateReadFlag/:notificationId",
    { schema: { params: userNotificationParamsSchema } },
    async (req, reply) => {
      const { userId, notificationId } = req.params;

      const notificationExists = await Notification.exists({
        _id: notificationId,
      });

      if (!notificationExists) {
        throw notFound("Notification not found!");
      }

      const updatedUser = await User.findOneAndUpdate(
        withSoftDeleteFilter({
          _id: userId,
          "notifications.notificationId": notificationId,
        }),
        { $set: { "notifications.$.readFlag": true } },
        { returnDocument: "after", lean: true },
      );

      if (!updatedUser) {
        throw notFound("User notification not updated!");
      }

      return reply.code(200).send({
        message: "User notification updated successfully!",
      });
    },
  );
};
