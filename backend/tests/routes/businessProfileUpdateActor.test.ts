/**
 * Actor classification for BUSINESS_PROFILE_UPDATED.
 *
 * The actor source is part of the communications payload, so these tests mock
 * the dispatch seam and exercise the real PATCH route through Fastify inject.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { generateTestToken, getTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import {
  createTestBusiness,
  createTestOwnerCompany,
} from "../helpers/fixtures.ts";

const dispatchEventMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/communications/dispatchEvent.ts", () => ({
  default: dispatchEventMock,
}));

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

function patchPayload(tradeName: string): {
  boundary: string;
  payload: string;
} {
  const boundary = "----formdata";
  return {
    boundary,
    payload: [
      `--${boundary}`,
      `Content-Disposition: form-data; name="tradeName"\r\n\r\n${tradeName}`,
      `--${boundary}--`,
    ].join("\r\n"),
  };
}

async function ownerAuthForBusiness(): Promise<{
  auth: string;
  businessId: string;
}> {
  const { user, company } = await createTestOwnerCompany();
  const business = await createTestBusiness({
    companyId: company._id,
    tradeName: "Actor Test Venue",
    currencyTrade: "USD",
    address: validAddress,
  });
  const auth = await generateTestToken({
    id: user._id.toString(),
    email: user.personalDetails.email,
    type: "user",
    role: "Customer",
  });
  return { auth, businessId: business._id.toString() };
}

async function membershipAuthForBusiness(
  businessId: Types.ObjectId,
  roles: string[],
): Promise<string> {
  const userId = new Types.ObjectId();
  const email = `actor-${userId}@test.com`;
  await User.create({
    _id: userId,
    personalDetails: {
      email,
      firstName: "Actor",
      lastName: "Member",
    },
  });
  const employee = await Employee.create({
    businessId,
    userId,
    allEmployeeRoles: roles,
    currentShiftRole: roles[0],
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    active: true,
  });
  return generateTestToken({
    id: userId.toString(),
    email,
    type: "user",
    role: roles[0],
    businessId: businessId.toString(),
    employeeId: employee._id.toString(),
    canLogAsEmployee: true,
  });
}

async function patchProfile(
  auth: string,
  businessId: string,
  tradeName: string,
) {
  const app = await getTestApp();
  const { boundary, payload } = patchPayload(tradeName);
  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/business/${businessId}`,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      authorization: auth,
    },
    payload,
  });
  return response;
}

function dispatchedActorSource(): string | undefined {
  const call = dispatchEventMock.mock.calls.at(-1);
  const eventPayload = call?.[1] as
    | { actor?: { source?: string } }
    | undefined;
  return eventPayload?.actor?.source;
}

describe("PATCH business profile actor classification", () => {
  beforeEach(() => {
    dispatchEventMock.mockClear();
    dispatchEventMock.mockResolvedValue(undefined);
  });

  it("classifies an owning caller as business owner", async () => {
    const { auth, businessId } = await ownerAuthForBusiness();

    const response = await patchProfile(auth, businessId, "Owner Updated");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({
      message: "Business updated successfully",
    });
    expect(dispatchEventMock).toHaveBeenCalledTimes(1);
    expect(dispatchEventMock.mock.calls[0]?.[0]).toBe(
      "BUSINESS_PROFILE_UPDATED",
    );
    expect(dispatchedActorSource()).toBe("businessOwner");
  });

  it.each([
    ["effective manager layer", "Manager", "manager"],
    ["effective admin layer", "Admin", "manager"],
    ["supervisor membership", "Supervisor", "system"],
    ["employee membership", "Waiter", "system"],
  ])("classifies a member with %s as %s", async (_label, role, expected) => {
    const business = await createTestBusiness({
      tradeName: `${role} Layer Venue`,
      currencyTrade: "USD",
      address: validAddress,
    });
    const auth = await membershipAuthForBusiness(business._id, [role]);

    const response = await patchProfile(
      auth,
      business._id.toString(),
      `${role} Updated`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({
      message: "Business updated successfully",
    });
    expect(dispatchedActorSource()).toBe(expected);
  });
});
