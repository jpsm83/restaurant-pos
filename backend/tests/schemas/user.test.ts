import { describe, it, expect } from "vitest";

import {
  createUserBodySchema,
  markNotificationDeletedBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userNotificationParamsSchema,
} from "restaurant-pos-packages/schemas/user";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

const validCreate = {
  username: "newuser",
  email: "New.User@Example.com",
  password: "Password123!",
  idType: "National ID",
  idNumber: "ID-123",
  address: JSON.stringify(validAddress),
  firstName: "New",
  lastName: "User",
  nationality: "USA",
  gender: "Man",
  birthDate: "1990-01-01",
  phoneNumber: "9876543210",
};

describe("createUserBodySchema", () => {
  it("accepts the required fields and normalizes the values", () => {
    const parsed = createUserBodySchema.parse(validCreate);
    expect(parsed.username).toBe("newuser");
    expect(parsed.email).toBe("new.user@example.com");
    expect(parsed.idType).toBe("National ID");
    expect(parsed.address).toEqual(validAddress);
    expect(parsed.gender).toBe("Man");
    expect(parsed.birthDate).toEqual(new Date("1990-01-01"));
  });

  it("parses the JSON-encoded address and rejects a missing required address field", () => {
    expect(
      createUserBodySchema.safeParse({
        ...validCreate,
        address: JSON.stringify({ country: "USA" }),
      }).success,
    ).toBe(false);

    expect(
      createUserBodySchema.safeParse({ ...validCreate, address: "{not json" })
        .success,
    ).toBe(false);
  });

  it("applies the shared password policy", () => {
    for (const password of ["short", "nouppercase1!", "NOLOWERCASE1!", "NoNumber!", "NoSymbol1"]) {
      expect(
        createUserBodySchema.safeParse({ ...validCreate, password }).success,
        password,
      ).toBe(false);
    }
    expect(
      createUserBodySchema.safeParse({
        ...validCreate,
        password: "Password123!",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid id type, gender, email and birth date", () => {
    expect(
      createUserBodySchema.safeParse({ ...validCreate, idType: "Passport Card" })
        .success,
    ).toBe(false);
    expect(
      createUserBodySchema.safeParse({ ...validCreate, gender: "Unknown" })
        .success,
    ).toBe(false);
    expect(
      createUserBodySchema.safeParse({ ...validCreate, email: "not-an-email" })
        .success,
    ).toBe(false);
    expect(
      createUserBodySchema.safeParse({ ...validCreate, birthDate: "not-a-date" })
        .success,
    ).toBe(false);
  });

  it("sanitizes structured fields and strips markup from names", () => {
    const parsed = createUserBodySchema.parse({
      ...validCreate,
      username: "  <b>new</b>   user ",
      firstName: "  New  ",
      nationality: "<i>USA</i>",
    });
    expect(parsed.username).toBe("new user");
    expect(parsed.firstName).toBe("New");
    expect(parsed.nationality).toBe("USA");
  });

  it("rejects missing required fields and unknown keys", () => {
    const { username: _drop, ...withoutUsername } = validCreate;
    expect(createUserBodySchema.safeParse(withoutUsername).success).toBe(false);
    expect(
      createUserBodySchema.safeParse({ ...validCreate, isAdmin: true }).success,
    ).toBe(false);
  });

  it("rejects server-owned fields", () => {
    for (const field of [
      "imageUrl",
      "emailVerified",
      "verificationToken",
      "resetPasswordToken",
      "refreshSessionVersion",
      "notifications",
    ]) {
      expect(
        createUserBodySchema.safeParse({ ...validCreate, [field]: "x" }).success,
        field,
      ).toBe(false);
    }
  });
});

describe("updateUserBodySchema", () => {
  it("treats a missing or blank password as not provided", () => {
    const { password: _drop, ...withoutPassword } = validCreate;
    expect(updateUserBodySchema.parse(withoutPassword).password).toBeUndefined();
    expect(
      updateUserBodySchema.parse({ ...validCreate, password: "  " }).password,
    ).toBeUndefined();
  });

  it("rejects a provided password that fails the policy", () => {
    expect(
      updateUserBodySchema.safeParse({ ...validCreate, password: "weak" })
        .success,
    ).toBe(false);
  });

  it("requires the identity fields and rejects unknown keys", () => {
    const { email: _drop, ...withoutEmail } = validCreate;
    expect(updateUserBodySchema.safeParse(withoutEmail).success).toBe(false);
    expect(
      updateUserBodySchema.safeParse({ ...validCreate, ratingCount: 5 }).success,
    ).toBe(false);
  });
});

describe("user path params and notification bodies", () => {
  it("userIdParamsSchema accepts a valid ObjectId and rejects a malformed one", () => {
    expect(userIdParamsSchema.safeParse({ userId: VALID_ID }).success).toBe(
      true,
    );
    expect(userIdParamsSchema.safeParse({ userId: "invalid-id" }).success).toBe(
      false,
    );
    expect(
      userIdParamsSchema.safeParse({ userId: VALID_ID, extra: "x" }).success,
    ).toBe(false);
  });

  it("markNotificationDeletedBodySchema requires an ObjectId notificationId", () => {
    expect(
      markNotificationDeletedBodySchema.safeParse({ notificationId: VALID_ID })
        .success,
    ).toBe(true);
    expect(
      markNotificationDeletedBodySchema.safeParse({ notificationId: "nope" })
        .success,
    ).toBe(false);
    expect(markNotificationDeletedBodySchema.safeParse({}).success).toBe(false);
  });

  it("userNotificationParamsSchema validates both ids", () => {
    expect(
      userNotificationParamsSchema.safeParse({
        userId: VALID_ID,
        notificationId: OTHER_ID,
      }).success,
    ).toBe(true);
    expect(
      userNotificationParamsSchema.safeParse({
        userId: "nope",
        notificationId: OTHER_ID,
      }).success,
    ).toBe(false);
  });
});
