/**
 * Users Routes — user CRUD and notification read/deleted flags.
 *
 * Multipart bodies (create and self update) are buffered and validated by the
 * shared multipart helper against strict zod DTOs from
 * `packages/schemas/user.ts`; the JSON-encoded `address` is parsed and validated
 * there, the shared password policy is applied, and emails are normalized. The
 * GET/PATCH/DELETE path params and the notification bodies are validated by
 * their DTOs. The database-backed duplicate and employee guards stay in the
 * route as named post-parse checks. Every error is raised as an `AppError` so
 * the global handler emits RFC 9457 `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose from "mongoose";
import { hash } from "bcrypt";
import type { IUser } from "domain/interfaces/IUser";
import type { IEmployee } from "domain/interfaces/IEmployee";

import { createOptionalAuthHook } from "../../auth/middleware.ts";
import {
  buildAuthUserSessionFromUserId,
  issueSessionWithRefreshCookie,
} from "../../auth/issueSession.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import deleteFolderCloudinary from "../../cloudinary/deleteFolderCloudinary.ts";
import User from "../../models/user.ts";
import Employee from "../../models/employee.ts";
import Notification from "../../models/notification.ts";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../../errors/appError.ts";
import { parseMultipart, type MultipartFile } from "../../schemas/multipart.ts";
import {
  createUserBodySchema,
  markNotificationDeletedBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userNotificationParamsSchema,
  type CreateUserBody,
  type MarkNotificationDeletedBody,
  type UserIdParams,
  type UserNotificationParams,
} from "domain/schemas/user";

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

/** Whether the duplicate username/email/idNumber belongs to another user. */
async function assertNoDuplicateUser(
  fields: Pick<CreateUserBody, "username" | "email" | "idNumber">,
  excludeUserId?: string,
): Promise<void> {
  const query: Record<string, unknown> = {
    $or: [
      { "personalDetails.username": fields.username },
      { "personalDetails.email": fields.email },
      { "personalDetails.idNumber": fields.idNumber },
    ],
  };
  if (excludeUserId) query._id = { $ne: excludeUserId };

  const duplicate = await User.exists(query);
  if (duplicate) {
    throw conflict("User with username, email or idNumber already exists!");
  }
}

/** The fields a create request contributes to the stored user. */
function toNewUser(
  userId: mongoose.Types.ObjectId,
  fields: CreateUserBody,
  hashedPassword: string,
): IUser {
  return {
    _id: userId,
    personalDetails: {
      username: fields.username,
      email: fields.email,
      password: hashedPassword,
      idType: fields.idType,
      idNumber: fields.idNumber,
      address: fields.address,
      firstName: fields.firstName,
      lastName: fields.lastName,
      nationality: fields.nationality,
      gender: fields.gender,
      birthDate: fields.birthDate,
      phoneNumber: fields.phoneNumber,
    },
  };
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  // GET /users - list all
  app.get("/", async (_req, reply) => {
    const users = await User.find(
      {},
      { "personalDetails.password": 0 },
    ).lean();

    if (!users?.length) {
      throw notFound("No users found!");
    }
    return reply.code(200).send(users);
  });

  // POST /users - create (formData with image)
  app.post("/", async (req, reply) => {
    const { fields, files } = await parseMultipart(req, createUserBodySchema);

    await assertNoDuplicateUser(fields);

    const userId = new mongoose.Types.ObjectId();
    const newUser = toNewUser(
      userId,
      fields,
      await hash(fields.password, 10),
    );

    const imageFile = files.find((file) => file.fieldname === IMAGE_FIELD);
    if (imageFile && imageFile.buffer.length > 0) {
      newUser.personalDetails.imageUrl = await uploadImage(
        `/users/${userId}`,
        imageFile,
      );
    }

    await User.create(newUser);

    return reply.code(201).send({ message: "New user created successfully" });
  });

  // GET /users/:userId - get by ID
  app.get<{ Params: UserIdParams }>(
    "/:userId",
    { schema: { params: userIdParamsSchema } },
    async (req, reply) => {
      const { userId } = req.params;

      const user = await User.findById(userId, {
        "personalDetails.password": 0,
      }).lean();

      if (!user) {
        throw notFound("User not found!");
      }
      return reply.code(200).send(user);
    },
  );

  // PATCH /users/:userId - update (formData with image); authenticated self only
  app.patch<{ Params: UserIdParams }>(
    "/:userId",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: { params: userIdParamsSchema },
    },
    async (req, reply) => {
      if (!req.authSession) {
        throw unauthorized("Authentication required");
      }
      if (req.authSession.type !== "user") {
        throw forbidden("User account required");
      }

      const { userId } = req.params;
      if (req.authSession.id !== userId) {
        throw forbidden("Forbidden");
      }

      const { fields, files } = await parseMultipart(req, updateUserBodySchema);

      const userDoc = await User.findById(userId).lean();
      if (!userDoc) {
        throw notFound("User not found!");
      }

      await assertNoDuplicateUser(fields, userId);

      const updateUserObj: Record<string, unknown> = {};
      const personalDetails = userDoc.personalDetails;

      if (fields.username !== personalDetails.username)
        updateUserObj["personalDetails.username"] = fields.username;
      if (fields.email !== personalDetails.email)
        updateUserObj["personalDetails.email"] = fields.email;
      if (fields.idType !== personalDetails.idType)
        updateUserObj["personalDetails.idType"] = fields.idType;
      if (fields.idNumber !== personalDetails.idNumber)
        updateUserObj["personalDetails.idNumber"] = fields.idNumber;
      if (fields.firstName !== personalDetails.firstName)
        updateUserObj["personalDetails.firstName"] = fields.firstName;
      if (fields.lastName !== personalDetails.lastName)
        updateUserObj["personalDetails.lastName"] = fields.lastName;
      if (fields.nationality !== personalDetails.nationality)
        updateUserObj["personalDetails.nationality"] = fields.nationality;
      if (fields.gender !== personalDetails.gender)
        updateUserObj["personalDetails.gender"] = fields.gender;
      if (fields.birthDate.getTime() !== personalDetails.birthDate?.getTime())
        updateUserObj["personalDetails.birthDate"] = fields.birthDate;
      if (fields.phoneNumber !== personalDetails.phoneNumber)
        updateUserObj["personalDetails.phoneNumber"] = fields.phoneNumber;

      const storedAddress = personalDetails.address as
        | Record<string, unknown>
        | undefined;
      for (const [key, value] of Object.entries(fields.address)) {
        if (value !== storedAddress?.[key]) {
          updateUserObj[`personalDetails.address.${key}`] = value;
        }
      }

      if (fields.password) {
        updateUserObj["personalDetails.password"] = await hash(
          fields.password,
          10,
        );
      }

      const imageFile = files.find((file) => file.fieldname === IMAGE_FIELD);
      if (imageFile && imageFile.buffer.length > 0) {
        const imageUrl = await uploadImage(`/users/${userId}`, imageFile);

        const deleteFilesCloudinaryResult: string | boolean =
          await deleteFilesCloudinary(personalDetails.imageUrl || "");

        if (deleteFilesCloudinaryResult !== true) {
          throw badRequest(String(deleteFilesCloudinaryResult));
        }

        updateUserObj["personalDetails.imageUrl"] = imageUrl;
      }

      const userUpdate: mongoose.UpdateQuery<Record<string, unknown>> = {
        $set: updateUserObj,
      };
      if (fields.password) {
        userUpdate.$inc = { refreshSessionVersion: 1 };
      }

      const updatedUser = await User.findByIdAndUpdate(userId, userUpdate, {
        returnDocument: "after",
        lean: true,
      });

      if (!updatedUser) {
        throw notFound("User not found!");
      }

      const session = await buildAuthUserSessionFromUserId(userId);
      if (!session) {
        throw notFound("User not found!");
      }
      const { accessToken, user: userOut } = issueSessionWithRefreshCookie(
        app,
        reply,
        session,
        {
          refreshSessionVersion:
            (updatedUser as { refreshSessionVersion?: number })
              .refreshSessionVersion ?? 0,
        },
      );

      return reply.code(200).send({
        message: "User updated successfully!",
        accessToken,
        user: userOut,
      });
    },
  );

  // DELETE /users/:userId - delete
  app.delete<{ Params: UserIdParams }>(
    "/:userId",
    { schema: { params: userIdParamsSchema } },
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

      const deletedUser = await User.findOneAndDelete({ _id: userId });

      if (!deletedUser) {
        throw notFound("User not found!");
      }

      const folderPath = `/users/${userId}`;

      const deleteFolderCloudinaryResult: string | boolean =
        await deleteFolderCloudinary(folderPath);

      if (deleteFolderCloudinaryResult !== true) {
        throw badRequest(
          typeof deleteFolderCloudinaryResult === "string"
            ? deleteFolderCloudinaryResult
            : "DeleteCloudinaryFolder failed!",
        );
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
          { _id: userId, "notifications.notificationId": notificationId },
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
        {
          _id: userId,
          "notifications.notificationId": notificationId,
        },
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
