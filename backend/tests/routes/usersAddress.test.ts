/**
 * Users address tests — additional details.
 *
 * The profile address carries an optional multiline `additionalDetails` field.
 * It is sanitized by the shared address contract, survives a save and reload,
 * clears with the rest of the address, and never exposes coordinates as an
 * editable field.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import User from "../../src/models/user.ts";
import { multipart } from "../helpers/multipart.ts";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

describe("Users address additional details", () => {
  beforeAll(() => {
    if (!process.env.APP_BASE_URL?.trim()) {
      process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    }
  });

  const createValidUser = async (emailPrefix: string) =>
    User.create({
      personalDetails: {
        email: `${emailPrefix}@test.com`,
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        address: validAddress,
      },
    });

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

  it("saves, sanitizes, and reloads additional details while preserving coordinates", async () => {
    const app = await getTestApp();
    const user = await createValidUser("addressdetails");
    const address = {
      ...validAddress,
      additionalDetails: "  <b>Gate code 1234</b>\nUse the side door\u0000  ",
      coordinates: [-118.24, 34.05],
    };

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${user._id}`,
      payload: multipart({ address: JSON.stringify(address) }),
      headers: {
        "content-type": "multipart/form-data",
        authorization: await tokenFor(user),
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().user.personalDetails.address).toMatchObject({
      additionalDetails: "Gate code 1234\nUse the side door",
      coordinates: [-118.24, 34.05],
    });

    const reload = await app.inject({
      method: "GET",
      url: `/api/v1/users/${user._id}`,
      headers: { authorization: await tokenFor(user) },
    });

    expect(reload.statusCode, reload.body).toBe(200);
    expect(reload.json().personalDetails.address).toMatchObject({
      additionalDetails: "Gate code 1234\nUse the side door",
      coordinates: [-118.24, 34.05],
    });
  });

  it("clears additional details with the rest of the address", async () => {
    const app = await getTestApp();
    const user = await createValidUser("clearaddressdetails");
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          "personalDetails.address.additionalDetails": "Gate code 1234",
          "personalDetails.address.coordinates": [-118.24, 34.05],
        },
      },
    );

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${user._id}`,
      payload: multipart({ address: "" }),
      headers: {
        "content-type": "multipart/form-data",
        authorization: await tokenFor(user),
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().user.personalDetails.address).toBeUndefined();

    const stored = await User.findById(user._id).lean();
    expect(stored?.personalDetails.address).toBeUndefined();
  });
});
