/**
 * Users Routes Tests
 *
 * The profile is self-only: a signed-in person may read and update only their
 * own client profile. Validation and error responses are asserted at the HTTP
 * seam as RFC 9457 `application/problem+json` documents. The anonymous listing
 * and creation routes are gone.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

const uploadFilesCloudinaryMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(["https://res.cloudinary.com/demo/image/upload/new.jpg"]),
);
const deleteFilesCloudinaryMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(true),
);
const deleteFolderCloudinaryMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(true),
);

vi.mock("../../src/cloudinary/uploadFilesCloudinary.ts", () => ({
  default: uploadFilesCloudinaryMock,
}));
vi.mock("../../src/cloudinary/deleteFilesCloudinary.ts", () => ({
  default: deleteFilesCloudinaryMock,
}));
vi.mock("../../src/cloudinary/deleteFolderCloudinary.ts", () => ({
  default: deleteFolderCloudinaryMock,
}));

import { Types } from "mongoose";
import bcrypt from "bcrypt";
import { getTestApp, generateTestToken } from "../setup.ts";
import User from "../../src/models/user.ts";
import Notification from "../../src/models/notification.ts";
import Business from "../../src/models/business.ts";
import { multipart } from "../helpers/multipart.ts";
import {
  detail,
  errorPaths,
  isProblemDetails,
} from "../helpers/problemDetails.ts";

describe("Users Routes", () => {
  beforeAll(() => {
    if (!process.env.APP_BASE_URL?.trim()) {
      process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    }
  });

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  const createValidUser = async (
    emailPrefix: string,
    overrides: Record<string, unknown> = {},
  ) => {
    return await User.create({
      personalDetails: {
        email: `${emailPrefix}@test.com`,
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        ...overrides,
      },
    });
  };

  const tokenFor = async (user: {
    _id: Types.ObjectId;
    personalDetails: { email: string };
  }) =>
    generateTestToken({
      id: user._id.toString(),
      email: user.personalDetails.email,
      type: "user",
      role: "Customer",
    });

  describe("removed anonymous user routes", () => {
    it("no longer lists users", async () => {
      const app = await getTestApp();
      await createValidUser("listuser");

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
      });

      expect(response.statusCode).toBe(404);
    });

    it("no longer creates users anonymously", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart({ email: "someone@test.com" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/users/:userId", () => {
    it("returns the signed-in person's full client profile", async () => {
      const app = await getTestApp();
      const user = await createValidUser("getbyid", {
        username: "getbyiduser",
        phoneNumber: "9876543210",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        address: validAddress,
        imageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
      });
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            languagePreference: "es",
            verificationToken: "token",
            resetPasswordToken: "reset",
            refreshSessionVersion: 2,
          },
        },
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}`,
        headers: { authorization: await tokenFor(user) },
      });

      expect(response.statusCode, response.body).toBe(200);
      const body = response.json();
      expect(body._id).toBe(user._id.toString());
      expect(body.languagePreference).toBe("es");
      expect(body.personalDetails.email).toBe("getbyid@test.com");
      expect(body.personalDetails).not.toHaveProperty("emailVerified");
      expect(body.personalDetails.address).toEqual(
        expect.objectContaining({ country: "USA", postCode: "90001" }),
      );
      expect(body.personalDetails).not.toHaveProperty("password");
      expect(body).not.toHaveProperty("password");
      expect(body).not.toHaveProperty("verificationToken");
      expect(body).not.toHaveProperty("resetPasswordToken");
      expect(body).not.toHaveProperty("refreshSessionVersion");
      expect(body).not.toHaveProperty("emailVerified");
    });

    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const user = await createValidUser("noauthget");

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}`,
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Authentication required");
    });

    it("returns 403 when reading another user's profile", async () => {
      const app = await getTestApp();
      const user = await createValidUser("otherget");
      const actor = await createValidUser("actorget");

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}`,
        headers: { authorization: await tokenFor(actor) },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("returns a validation problem for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns 404 for a missing user when the token matches the URL", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: fakeId.toString(),
        email: "ghost@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${fakeId}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("User not found!");
    });
  });

  describe("PATCH /api/v1/users/:userId", () => {
    it("returns a validation problem for an invalid userId", async () => {
      const app = await getTestApp();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "any@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id",
        payload: multipart({ firstName: "Pat" }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: auth,
        },
      });

      expect(response.statusCode, response.body).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns 401 when PATCH user without auth", async () => {
      const app = await getTestApp();
      const user = await createValidUser("noauthpatch");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart({ firstName: "Pat" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Authentication required");
    });

    it("returns 403 when the JWT does not match the URL id", async () => {
      const app = await getTestApp();
      const user = await createValidUser("forbiddenpatch");
      const otherUser = await createValidUser("forbiddenpatchother");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart({ firstName: "Pat" }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: await tokenFor(otherUser),
        },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("returns 404 for a non-existent user when the JWT matches the URL id", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: fakeId.toString(),
        email: "ghost@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${fakeId}`,
        payload: multipart({ firstName: "Pat" }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: auth,
        },
      });

      expect(response.statusCode, response.body).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("User not found!");
    });

    it("updates optional profile fields and language without replacing the session", async () => {
      const app = await getTestApp();
      const email = "updateself@test.com";
      const password = "TestPassword123!";
      const user = await User.create({
        personalDetails: {
          email,
          password: await bcrypt.hash(password, 10),
          firstName: "Old",
          username: "oldname",
        },
      });

      const login = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password },
      });
      expect(login.statusCode).toBe(200);
      const accessToken = login.json().accessToken as string;
      const originalRefreshCookie = login.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      )!.value;

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart({
          username: "newname",
          firstName: "New",
          lastName: "Person",
          phoneNumber: "9876543210",
          nationality: "USA",
          gender: "Woman",
          birthDate: "1990-01-01",
          address: JSON.stringify(validAddress),
          languagePreference: "es",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      const body = response.json();
      expect(body.message).toBe("User updated successfully!");
      expect(body.accessToken).toBeUndefined();
      expect(body.user.personalDetails.username).toBe("newname");
      expect(body.user.personalDetails.firstName).toBe("New");
      expect(body.user.personalDetails.lastName).toBe("Person");
      expect(body.user.personalDetails.gender).toBe("Woman");
      expect(body.user.personalDetails.address).toEqual(
        expect.objectContaining(validAddress),
      );
      expect(body.user.languagePreference).toBe("es");
      expect(body.user.personalDetails).not.toHaveProperty("password");
      expect(
        response.cookies.find((cookie) => cookie.name === "refresh_token"),
      ).toBeUndefined();

      const stored = await User.findById(user._id).lean();
      expect(stored?.personalDetails.username).toBe("newname");
      expect(stored?.languagePreference).toBe("es");

      const refresh = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${originalRefreshCookie}` },
      });
      expect(refresh.statusCode).toBe(200);
      expect(refresh.json().user.languagePreference).toBe("es");

      const me = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(me.statusCode).toBe(200);
      expect(me.json().user.languagePreference).toBe("es");
    });

    it("clears optional fields and the address when they are sent blank", async () => {
      const app = await getTestApp();
      const user = await createValidUser("clearprofile", {
        username: "clearuser",
        firstName: "Clear",
        phoneNumber: "1234567890",
        address: validAddress,
      });
      await User.updateOne(
        { _id: user._id },
        { $set: { languagePreference: "en" } },
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart({
          username: "",
          firstName: "",
          phoneNumber: "",
          birthDate: "",
          gender: "",
          nationality: "",
          address: "",
          languagePreference: "",
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: await tokenFor(user),
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      const body = response.json();
      expect(body.user.personalDetails.username).toBeUndefined();
      expect(body.user.personalDetails.firstName).toBeUndefined();
      expect(body.user.personalDetails.phoneNumber).toBeUndefined();
      expect(body.user.personalDetails.address).toBeUndefined();
      expect(body.user.languagePreference).toBeUndefined();

      const stored = await User.findById(user._id).lean();
      expect(stored?.personalDetails.username).toBeUndefined();
      expect(stored?.personalDetails.address).toBeUndefined();
      expect(stored?.languagePreference).toBeUndefined();
    });

    it("rejects password, email, employment identifiers, server-owned fields and unknown keys", async () => {
      const app = await getTestApp();
      const user = await createValidUser("rejectfields");
      const auth = await tokenFor(user);

      for (const field of [
        "password",
        "email",
        "idType",
        "idNumber",
        "imageUrl",
        "emailVerified",
        "verificationToken",
        "refreshSessionVersion",
        "isAdmin",
      ]) {
        const response = await app.inject({
          method: "PATCH",
          url: `/api/v1/users/${user._id}`,
          payload: multipart({ [field]: "x" }),
          headers: {
            "content-type": "multipart/form-data",
            authorization: auth,
          },
        });

        expect(response.statusCode, `${field}: ${response.body}`).toBe(400);
        expect(isProblemDetails(response)).toBe(true);
      }
    });

    it("rejects an incomplete address", async () => {
      const app = await getTestApp();
      const user = await createValidUser("badaddress");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart({
          address: JSON.stringify({ country: "USA" }),
        }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: await tokenFor(user),
        },
      });

      expect(response.statusCode, response.body).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("address.state");
    });

    it("uploads a replacement photo and deletes the previous asset", async () => {
      const app = await getTestApp();
      uploadFilesCloudinaryMock.mockClear();
      deleteFilesCloudinaryMock.mockClear();
      const previousImageUrl =
        "https://res.cloudinary.com/demo/image/upload/previous.jpg";
      const user = await createValidUser("replacephoto", {
        imageUrl: previousImageUrl,
      });

      const form = new FormData();
      form.append("firstName", "Photo");
      form.append(
        "imageUrl",
        new Blob(["image-bytes"], { type: "image/png" }),
        "avatar.png",
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: form,
        headers: {
          "content-type": "multipart/form-data",
          authorization: await tokenFor(user),
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(uploadFilesCloudinaryMock).toHaveBeenCalledTimes(1);
      expect(uploadFilesCloudinaryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: `/users/${user._id}`,
          onlyImages: true,
        }),
      );
      expect(deleteFilesCloudinaryMock).toHaveBeenCalledWith(previousImageUrl);
      expect(response.json().user.personalDetails.imageUrl).toBe(
        "https://res.cloudinary.com/demo/image/upload/new.jpg",
      );

      const stored = await User.findById(user._id).lean();
      expect(stored?.personalDetails.imageUrl).toBe(
        "https://res.cloudinary.com/demo/image/upload/new.jpg",
      );
    });
  });

  describe("DELETE /api/v1/users/:userId", () => {
    it("returns a validation problem for an invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/users/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns 404 for non-existent user", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("User not found!");
    });

    it("soft-deletes a user and keeps the record for includeDeleted reads", async () => {
      const app = await getTestApp();
      deleteFolderCloudinaryMock.mockClear();
      const user = await createValidUser("softdelete-user");

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${user._id}`,
      });
      expect(response.statusCode, response.body).toBe(200);

      const persisted = await User.findById(user._id)
        .setOptions({ includeDeleted: true })
        .select("deleted deletedAt")
        .lean();
      expect(persisted).toBeTruthy();
      expect(persisted?.deleted).toBe(true);
      expect(persisted?.deletedAt).toBeInstanceOf(Date);

      const hiddenByDefault = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}`,
        headers: { authorization: await tokenFor(user) },
      });
      expect(hiddenByDefault.statusCode).toBe(401);
      expect(deleteFolderCloudinaryMock).not.toHaveBeenCalled();
    });

    it("records the signed-in account that deleted the user", async () => {
      const app = await getTestApp();
      const actor = await createValidUser("delete-actor");
      const target = await createValidUser("delete-target");

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${target._id}`,
        headers: { authorization: await tokenFor(actor) },
      });
      expect(response.statusCode, response.body).toBe(200);

      const persisted = await User.findById(target._id)
        .setOptions({ includeDeleted: true })
        .select("deleted deletedBy")
        .lean();
      expect(persisted?.deleted).toBe(true);
      expect(String(persisted?.deletedBy)).toBe(String(actor._id));
    });
  });

  describe("PATCH /api/v1/users/:userId/markNotificationAsDeleted", () => {
    it("returns a validation problem for an invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id/markNotificationAsDeleted",
        payload: { notificationId: new Types.ObjectId().toString() },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns a validation problem for an invalid notificationId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${new Types.ObjectId()}/markNotificationAsDeleted`,
        payload: { notificationId: "invalid" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("notificationId");
    });

    it("returns 404 for non-existent notification", async () => {
      const app = await getTestApp();

      const user = await createValidUser("notifuser");
      const fakeNotificationId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/markNotificationAsDeleted`,
        payload: { notificationId: fakeNotificationId.toString() },
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Notification not found!");
    });
  });

  describe("PATCH /api/v1/users/:userId/updateReadFlag/:notificationId", () => {
    it("returns a validation problem for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id/updateReadFlag/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toEqual(
        expect.arrayContaining(["userId", "notificationId"]),
      );
    });

    it("returns 404 for non-existent notification", async () => {
      const app = await getTestApp();

      const user = await createValidUser("readflaguser");
      const fakeNotificationId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/updateReadFlag/${fakeNotificationId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Notification not found!");
    });

    it("marks user notification as read", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Read Flag Business",
        legalName: "Read Flag Business LLC",
        email: "read-flag-business@test.com",
        phoneNumber: "1234567890",
        taxNumber: `READ-FLAG-${Date.now()}`,
        currencyTrade: "USD",
        address: validAddress,
      });

      const notification = await Notification.create({
        message: "Read me",
        notificationType: "Info",
        businessId: business._id,
      });

      const user = await User.create({
        notifications: [
          {
            notificationId: notification._id,
            readFlag: false,
            deletedFlag: false,
          },
        ],
        personalDetails: {
          email: `readflagmarkuser-${Date.now()}@test.com`,
          password: "hashedpassword",
        },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/updateReadFlag/${notification._id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toContain("updated");

      const updatedUser = await User.findById(user._id).lean();
      const updatedUserNotification = updatedUser?.notifications?.find(
        (n: { notificationId?: Types.ObjectId }) =>
          n.notificationId?.toString() === notification._id.toString(),
      );
      expect(updatedUserNotification?.readFlag).toBe(true);
      expect(updatedUserNotification?.deletedFlag).toBe(false);
    });
  });

  describe("markNotificationAsDeleted transaction", () => {
    it("marks notification as deleted and sets readFlag", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Test Business",
        legalName: "Test Business LLC",
        email: "business@test.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const notification = await Notification.create({
        message: "This is a test notification",
        notificationType: "Info",
        businessId: business._id,
      });

      const user = await User.create({
        notifications: [
          {
            notificationId: notification._id,
            readFlag: false,
            deletedFlag: false,
          },
        ],
        personalDetails: {
          email: "markdelete@test.com",
          password: "hashedpassword",
        },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/markNotificationAsDeleted`,
        payload: { notificationId: notification._id.toString() },
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().message).toContain("deleted");

      const updatedUser = await User.findById(user._id).lean();
      const userNotification = updatedUser?.notifications?.find(
        (n: { notificationId?: Types.ObjectId }) =>
          n.notificationId?.toString() === notification._id.toString(),
      );
      expect(userNotification?.deletedFlag).toBe(true);
      expect(userNotification?.readFlag).toBe(true);
    });
  });
});
