import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import { hash } from "bcrypt";
import type { IUser } from "../../../../packages/interfaces/IUser.ts";
import type { IEmployee } from "../../../../packages/interfaces/IEmployee.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import {
  createAuthHook,
  requireUserIdMatchesSessionHook,
  requireValidObjectIdParamHook,
} from "../../auth/middleware.ts";
import {
  buildAuthUserSessionFromUserId,
  issueSessionWithRefreshCookie,
} from "../../auth/issueSession.ts";
import objDefaultValidation, {
  type ObjDefaultValidationType,
} from "../../../../packages/utils/objDefaultValidation.ts";
import {
  isValidPassword,
  PASSWORD_POLICY_MESSAGE,
} from "../../../../packages/utils/passwordPolicy.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import deleteFilesCloudinary from "../../cloudinary/deleteFilesCloudinary.ts";
import deleteFolderCloudinary from "../../cloudinary/deleteFolderCloudinary.ts";
import User from "../../models/user.ts";
import Employee from "../../models/employee.ts";
import Notification from "../../models/notification.ts";

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

export const usersRoutes: FastifyPluginAsync = async (app) => {
  // GET /users - list all
  app.get("/", async (_req, reply) => {
    try {
      const users = await User.find(
        {},
        { "personalDetails.password": 0 },
      ).lean();

      if (!users?.length) {
        return reply.code(404).send({ message: "No users found" });
      }
      return reply.code(200).send(users);
    } catch (error) {
      return reply.code(500).send({
        message: "Get all users failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // POST /users - create (formData with image)
  app.post("/", async (req, reply) => {
    try {
      const fields: Record<string, string> = {};
      let imageFile: {
        buffer: Buffer;
        filename: string;
        mimeType: string;
      } | null = null;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          if (part.fieldname === "imageUrl") {
            const buffer = await part.toBuffer();
            imageFile = {
              buffer,
              filename: part.filename,
              mimeType: part.mimetype,
            };
          }
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      const username = fields.username;
      const email = fields.email;
      const password = fields.password;
      const idType = fields.idType;
      const idNumber = fields.idNumber;
      const address = fields.address ? JSON.parse(fields.address) : null;
      const firstName = fields.firstName;
      const lastName = fields.lastName;
      const nationality = fields.nationality;
      const gender = fields.gender;
      const birthDate = fields.birthDate;
      const phoneNumber = fields.phoneNumber;

      if (
        !username ||
        !email ||
        !password ||
        !idType ||
        !idNumber ||
        !address ||
        !firstName ||
        !lastName ||
        !nationality ||
        !gender ||
        !birthDate ||
        !phoneNumber
      ) {
        return reply.code(400).send({
          message:
            "Username, email, password, idType, idNumber, address, firstName, lastName, nationality, gender, birthDate, phoneNumber are required!",
        });
      }

      const addressValidationResult = (objDefaultValidation as unknown as ObjDefaultValidationType)(
        address,
        reqAddressFields,
        nonReqAddressFields,
      );

      if (addressValidationResult !== true) {
        return reply.code(400).send({ message: addressValidationResult });
      }

      if (!isValidPassword(password)) {
        return reply.code(400).send({ message: PASSWORD_POLICY_MESSAGE });
      }

      const duplicateUser = await User.exists({
        $or: [
          { "personalDetails.username": username },
          { "personalDetails.email": email },
          { "personalDetails.idNumber": idNumber },
        ],
      });

      if (duplicateUser) {
        return reply.code(409).send({
          message: "User with username, email or idNumber already exists!",
        });
      }

      const hashedPassword = await hash(password, 10);

      const userId = new mongoose.Types.ObjectId();

      const newUser: IUser = {
        _id: userId,
        personalDetails: {
          username,
          email,
          password: hashedPassword,
          idType,
          idNumber,
          address,
          firstName,
          lastName,
          nationality,
          gender,
          birthDate,
          phoneNumber,
        },
      };

      if (imageFile && imageFile.buffer.length > 0) {
        const folder = `/users/${userId}`;

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

        newUser.personalDetails.imageUrl = cloudinaryUploadResponse[0];
      }

      await User.create(newUser);

      return reply.code(201).send({ message: "New user created successfully" });
    } catch (error) {
      return reply.code(500).send({
        message: "Create user failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /users/:userId - get by ID
  app.get("/:userId", async (req, reply) => {
    try {
      const params = req.params as { userId?: string };
      const userId = params.userId;

      if (!userId || !isObjectIdValid([userId])) {
        return reply.code(400).send({ message: "Invalid user ID!" });
      }

      const user = await User.findById(userId, {
        "personalDetails.password": 0,
      }).lean();

      if (!user) {
        return reply.code(404).send({ message: "User not found!" });
      }
      return reply.code(200).send(user);
    } catch (error) {
      return reply.code(500).send({
        message: "Get user by its id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /users/:userId - update (formData with image); authenticated self only
  app.patch(
    "/:userId",
    {
      preValidation: [
        requireValidObjectIdParamHook("userId"),
        createAuthHook(app),
        requireUserIdMatchesSessionHook(),
      ],
    },
    async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId!;

    try {
      const fields: Record<string, string> = {};
      let imageFile: {
        buffer: Buffer;
        filename: string;
        mimeType: string;
      } | null = null;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          if (part.fieldname === "imageUrl") {
            const buffer = await part.toBuffer();
            imageFile = {
              buffer,
              filename: part.filename,
              mimeType: part.mimetype,
            };
          }
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      const username = fields.username;
      const email = fields.email;
      const password = fields.password;
      const idType = fields.idType;
      const idNumber = fields.idNumber;
      const address = fields.address ? JSON.parse(fields.address) : null;
      const firstName = fields.firstName;
      const lastName = fields.lastName;
      const nationality = fields.nationality;
      const gender = fields.gender;
      const birthDate = fields.birthDate;
      const phoneNumber = fields.phoneNumber;

      if (
        !username ||
        !email ||
        !idType ||
        !idNumber ||
        !address ||
        !firstName ||
        !lastName ||
        !nationality ||
        !gender ||
        !birthDate ||
        !phoneNumber
      ) {
        return reply.code(400).send({
          message:
            "Username, email, idType, idNumber, address, firstName, lastName, nationality, gender, birthDate, phoneNumber are required!",
        });
      }

      const addressValidationResult = (objDefaultValidation as unknown as ObjDefaultValidationType)(
        address,
        reqAddressFields,
        nonReqAddressFields,
      );

      if (addressValidationResult !== true) {
        return reply.code(400).send({ message: addressValidationResult });
      }

      if (password && !isValidPassword(password)) {
        return reply.code(400).send({ message: PASSWORD_POLICY_MESSAGE });
      }

      const userDoc = await User.findById(userId);

      if (!userDoc) {
        return reply.code(404).send({ message: "User not found!" });
      }

      const duplicateCustomer = await User.exists({
        _id: { $ne: userId },
        $or: [
          { "personalDetails.username": username },
          { "personalDetails.email": email },
          { "personalDetails.idNumber": idNumber },
        ],
      });

      if (duplicateCustomer) {
        return reply.code(409).send({
          message: "User with username, email or idNumber already exists!",
        });
      }

      const updateUserObj: Record<string, unknown> = {};

      if (username && username !== userDoc.personalDetails.username) {
        updateUserObj["personalDetails.username"] = username;
      }
      if (email && email !== userDoc.personalDetails.email) {
        updateUserObj["personalDetails.email"] = email;
      }
      if (idType && idType !== userDoc.personalDetails.idType) {
        updateUserObj["personalDetails.idType"] = idType;
      }
      if (idNumber && idNumber !== userDoc.personalDetails.idNumber) {
        updateUserObj["personalDetails.idNumber"] = idNumber;
      }
      if (firstName && firstName !== userDoc.personalDetails.firstName) {
        updateUserObj["personalDetails.firstName"] = firstName;
      }
      if (lastName && lastName !== userDoc.personalDetails.lastName) {
        updateUserObj["personalDetails.lastName"] = lastName;
      }
      if (nationality && nationality !== userDoc.personalDetails.nationality) {
        updateUserObj["personalDetails.nationality"] = nationality;
      }
      if (gender && gender !== userDoc.personalDetails.gender) {
        updateUserObj["personalDetails.gender"] = gender;
      }
      if (
        birthDate &&
        birthDate !== userDoc.personalDetails.birthDate?.toISOString()
      ) {
        updateUserObj["personalDetails.birthDate"] = birthDate;
      }
      if (phoneNumber && phoneNumber !== userDoc.personalDetails.phoneNumber) {
        updateUserObj["personalDetails.phoneNumber"] = phoneNumber;
      }

      if (address) {
        Object.keys(address).forEach((key) => {
          if (
            address[key] !==
            (userDoc.personalDetails.address as Record<string, unknown>)?.[key]
          ) {
            updateUserObj[`personalDetails.address.${key}`] = address[key];
          }
        });
      }

      if (password) {
        updateUserObj["personalDetails.password"] = await hash(password, 10);
      }

      if (imageFile && imageFile.buffer.length > 0) {
        const folder = `/users/${userId}`;

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
          await deleteFilesCloudinary(userDoc?.personalDetails.imageUrl || "");

        if (deleteFilesCloudinaryResult !== true) {
          return reply.code(400).send({ message: deleteFilesCloudinaryResult });
        }

        updateUserObj["personalDetails.imageUrl"] = cloudinaryUploadResponse[0];
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateUserObj },
        { new: true, lean: true },
      );

      if (!updatedUser) {
        return reply.code(404).send({ message: "User not found!" });
      }

      const session = await buildAuthUserSessionFromUserId(userId);
      if (!session) {
        return reply.code(404).send({ message: "User not found!" });
      }
      const { accessToken, user: userOut } = issueSessionWithRefreshCookie(
        app,
        reply,
        session,
      );

      return reply.code(200).send({
        message: "User updated successfully!",
        accessToken,
        user: userOut,
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Update user failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  },
  );

  // DELETE /users/:userId - delete
  app.delete("/:userId", async (req, reply) => {
    try {
      const params = req.params as { userId?: string };
      const userId = params.userId;

      if (!userId || !isObjectIdValid([userId])) {
        return reply.code(400).send({ message: "Invalid user ID!" });
      }

      const employee = (await Employee.findOne({ userId })
        .select("terminatedDate")
        .lean()) as IEmployee | null;

      if (employee?.terminatedDate) {
        return reply.code(400).send({
          message: "User cannot be deleted because he/she is employeed!",
        });
      }

      const deletedUser = await User.findOneAndDelete({ _id: userId });

      if (!deletedUser) {
        return reply.code(404).send({ message: "User not found!" });
      }

      const folderPath = `/users/${userId}`;

      const deleteFolderCloudinaryResult: string | boolean =
        await deleteFolderCloudinary(folderPath);

      if (deleteFolderCloudinaryResult !== true) {
        return reply.code(400).send({ message: deleteFolderCloudinaryResult });
      }

      return reply.code(200).send({ message: "User deleted successfully" });
    } catch (error) {
      return reply.code(500).send({
        message: "Delete user failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /users/:userId/markNotificationAsDeleted - mark notification deleted (transaction)
  app.patch("/:userId/markNotificationAsDeleted", async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId;

    const { notificationId } = req.body as { notificationId?: string };

    if (
      !userId ||
      !notificationId ||
      !isObjectIdValid([userId, notificationId])
    ) {
      return reply.code(400).send({
        message: "User or notification ID is not valid!",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const notificationExists = await Notification.exists({
        _id: notificationId,
      }).session(session);

      if (!notificationExists) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Notification not found!" });
      }

      const updatedCustomer = await User.findOneAndUpdate(
        { _id: userId, "notifications.notificationId": notificationId },
        {
          $set: {
            "notifications.$.deletedFlag": true,
            "notifications.$.readFlag": true,
          },
        },
        { new: true, lean: true, session },
      );

      if (!updatedCustomer) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "User not found!" });
      }

      await session.commitTransaction();

      return reply.code(200).send({
        message: "User notification mark as deleted successfully!",
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Update notification read flag from user failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // PATCH /users/:userId/updateReadFlag/:notificationId - update read flag
  app.patch("/:userId/updateReadFlag/:notificationId", async (req, reply) => {
    try {
      const params = req.params as { userId?: string; notificationId?: string };
      const { userId, notificationId } = params;

      if (
        !userId ||
        !notificationId ||
        !isObjectIdValid([userId, notificationId])
      ) {
        return reply.code(400).send({
          message: "User or notification ID is not valid!",
        });
      }

      const notificationExists = await Notification.exists({
        _id: notificationId,
      });

      if (!notificationExists) {
        return reply.code(404).send({ message: "Notification not found!" });
      }

      const updatedCustomer = await User.findOneAndUpdate(
        {
          _id: userId,
          "notifications.notificationId": notificationId,
        },
        { $set: { "notifications.$.readFlag": true } },
        { new: true, lean: true },
      );

      if (!updatedCustomer) {
        return reply
          .code(404)
          .send({ message: "User notification not updated!" });
      }

      return reply.code(200).send({
        message: "User notification updated successfully!",
      });
    } catch (error) {
      return reply.code(500).send({
        message: "Update notification read flag from user failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};
