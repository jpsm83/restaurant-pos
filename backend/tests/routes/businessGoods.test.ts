/**
 * BusinessGoods Routes Tests - Phase 1 Module 3 + Phase 5 Task 5.3
 * Tests for business goods CRUD endpoints
 * Phase 5: Cloudinary tests for image uploads (skipped - ESM mocking limitation)
 *
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import Business from "../../src/models/business.ts";
import Supplier from "../../src/models/supplier.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import { isProblemDetails } from "../helpers/problemDetails.ts";

const boundary = "----formdata";
const multipartHeaders = {
  "content-type": `multipart/form-data; boundary=${boundary}`,
};

const multipartPayload = (fields: Record<string, string>): string =>
  Object.entries(fields)
    .map(
      ([name, value]) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    )
    .join("") + `--${boundary}--\r\n`;

describe("BusinessGoods Routes", () => {
  let businessId: Types.ObjectId;

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: "TAX-001",
      currencyTrade: "USD",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
    });
    businessId = business._id;
  });

  describe("GET /api/v1/businessGoods", () => {
    it("lists all business goods", async () => {
      const app = await getTestApp();

      await BusinessGood.create({
        businessId,
        name: "Burger",
        keyword: "burger",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 12.99,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/businessGoods",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].name).toBe("Burger");
    });

    it("returns 404 when no business goods exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/businessGoods",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No businessId goods found!");
    });
  });

  describe("GET /api/v1/businessGoods/:businessGoodId", () => {
    it("gets business good by ID", async () => {
      const app = await getTestApp();

      const businessGood = await BusinessGood.create({
        businessId,
        name: "Pizza",
        keyword: "pizza",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 15.99,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/businessGoods/${businessGood._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Pizza");
    });

    it("returns a problem-details 400 for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/businessGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      const body = JSON.parse(response.body);
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.errors[0].path).toBe("businessGoodId");
    });

    it("returns 404 for non-existent business good", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/businessGoods/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
    });
  });

  describe("POST /api/v1/businessGoods", () => {
    it("creates business good with valid data", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "New Burger",
          keyword: "newburger",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "14.99",
          businessId: String(businessId),
        }),
      });

      expect(response.statusCode).toBe(201);
      const created = await BusinessGood.findOne({ name: "New Burger" });
      expect(created).not.toBeNull();
    });

    it("returns a problem-details 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({ name: "Incomplete Item" }),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      const paths = JSON.parse(response.body).errors.map(
        (e: { path: string }) => e.path,
      );
      expect(paths).toContain("keyword");
      expect(paths).toContain("sellingPrice");
    });

    it("returns a problem-details 400 for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Test Item",
          keyword: "testitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
          businessId: "invalid-id",
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).errors[0].path).toBe("businessId");
    });

    it("returns a problem-details 400 for an invalid mainCategory", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Test Item",
          keyword: "testitem",
          mainCategory: "InvalidCategory",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
          businessId: String(businessId),
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).errors[0].path).toBe("mainCategory");
    });

    it("rejects a field the DTO does not own", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Test Item",
          keyword: "testitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
          businessId: String(businessId),
          costPrice: "3.50",
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("returns a problem-details 400 for malformed JSON ingredients", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Test Item",
          keyword: "testitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
          businessId: String(businessId),
          ingredients: "{not json",
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      const errors = JSON.parse(response.body).errors as Array<{
        path: string;
        message: string;
      }>;
      expect(errors.some((e) => e.message === "Invalid JSON")).toBe(true);
    });

    it("preserves the ingredients-XOR-setMenu rule as a post-parse 400", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Test Item",
          keyword: "testitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
          businessId: String(businessId),
          ingredients: JSON.stringify([
            {
              supplierGoodId: new Types.ObjectId().toString(),
              measurementUnit: "unit",
              requiredQuantity: 1,
            },
          ]),
          setMenuIds: JSON.stringify([new Types.ObjectId().toString()]),
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe(
        "Only one of ingredients or setMenuIds can be assigned!",
      );
    });

    it("parses ingredients and computes the cost price", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Test Supplier",
        legalName: "Test Supplier Legal",
        taxNumber: "TAX-SUP-001",
        email: "supplier@test.com",
        phoneNumber: "1234567890",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      });
      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId: supplier._id,
        name: "Flour",
        keyword: "flour",
        mainCategory: "Food",
        currentlyInUse: true,
        measurementUnit: "unit",
        pricePerMeasurementUnit: 2,
        parLevel: 10,
        allergens: ["Gluten"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Test Item",
          keyword: "testitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
          businessId: String(businessId),
          ingredients: JSON.stringify([
            {
              supplierGoodId: String(supplierGood._id),
              measurementUnit: "unit",
              requiredQuantity: 3,
            },
          ]),
        }),
      });

      expect(response.statusCode).toBe(201);
      const created = await BusinessGood.findOne({ name: "Test Item" }).lean();
      expect(created?.costPrice).toBe(6);
      expect(created?.allergens).toContain("Gluten");
    });

    it("returns a problem-details 400 for more than three files", async () => {
      const app = await getTestApp();

      const fields: Record<string, string> = {
        name: "Test Item",
        keyword: "testitem",
        mainCategory: "Food",
        onMenu: "true",
        available: "true",
        sellingPrice: "10.00",
        businessId: String(businessId),
      };
      const textParts = Object.entries(fields)
        .map(
          ([name, value]) =>
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        )
        .join("");
      const fileParts = [0, 1, 2, 3]
        .map(
          (i) =>
            `--${boundary}\r\nContent-Disposition: form-data; name="img${i}"; filename="img${i}.png"\r\nContent-Type: image/png\r\n\r\nnot-a-real-image\r\n`,
        )
        .join("");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: textParts + fileParts + `--${boundary}--\r\n`,
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe(
        "Max file quantity is 3!",
      );
    });

    it("returns a problem-details 400 for duplicate business good name", async () => {
      const app = await getTestApp();

      await BusinessGood.create({
        businessId,
        name: "Existing Item",
        keyword: "existingitem",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10.0,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Existing Item",
          keyword: "existingitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
          businessId: String(businessId),
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toContain("already exists");
    });
  });

  describe("PATCH /api/v1/businessGoods/:businessGoodId", () => {
    it("returns a problem-details 400 for an invalid businessGoodId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/businessGoods/invalid-id",
        headers: multipartHeaders,
        payload: multipartPayload({}),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).errors[0].path).toBe("businessGoodId");
    });

    it("returns 404 for non-existent business good", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/businessGoods/${fakeId}`,
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Updated Item",
          keyword: "updateditem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "15.00",
        }),
      });

      expect(response.statusCode).toBe(404);
    });

    it("updates business good successfully", async () => {
      const app = await getTestApp();

      const businessGood = await BusinessGood.create({
        businessId,
        name: "Original Item",
        keyword: "originalitem",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10.0,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/businessGoods/${businessGood._id}`,
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Updated Item",
          keyword: "originalitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "15.00",
        }),
      });

      expect(response.statusCode).toBe(200);

      const updated = await BusinessGood.findById(businessGood._id);
      expect(updated?.name).toBe("Updated Item");
      expect(updated?.sellingPrice).toBe(15.0);
    });

    it("preserves the ingredients-XOR-setMenu rule as a post-parse 400", async () => {
      const app = await getTestApp();

      const businessGood = await BusinessGood.create({
        businessId,
        name: "Original Item",
        keyword: "originalitem",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10.0,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/businessGoods/${businessGood._id}`,
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Original Item",
          keyword: "originalitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
          ingredients: JSON.stringify([
            {
              supplierGoodId: new Types.ObjectId().toString(),
              measurementUnit: "unit",
              requiredQuantity: 1,
            },
          ]),
          setMenuIds: JSON.stringify([new Types.ObjectId().toString()]),
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe(
        "Only one of ingredients or setMenuIds can be assigned!",
      );
    });

    it("returns a problem-details 409 for a duplicate name", async () => {
      const app = await getTestApp();

      await BusinessGood.create({
        businessId,
        name: "Taken Item",
        keyword: "takenitem",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10.0,
      });
      const businessGood = await BusinessGood.create({
        businessId,
        name: "Original Item",
        keyword: "originalitem",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10.0,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/businessGoods/${businessGood._id}`,
        headers: multipartHeaders,
        payload: multipartPayload({
          name: "Taken Item",
          keyword: "originalitem",
          mainCategory: "Food",
          onMenu: "true",
          available: "true",
          sellingPrice: "10.00",
        }),
      });

      expect(response.statusCode).toBe(409);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toContain("already exists");
    });
  });

  describe("DELETE /api/v1/businessGoods/:businessGoodId", () => {
    it("returns a problem-details 400 for an invalid businessGoodId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/businessGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).errors[0].path).toBe("businessGoodId");
    });
  });

  describe("GET /api/v1/businessGoods/business/:businessId", () => {
    it("lists business goods by business", async () => {
      const app = await getTestApp();

      await BusinessGood.create([
        {
          businessId,
          name: "Item 1",
          keyword: "item1",
          mainCategory: "Food",
          onMenu: true,
          available: true,
          sellingPrice: 10.0,
        },
        {
          businessId,
          name: "Item 2",
          keyword: "item2",
          mainCategory: "Beverage",
          onMenu: true,
          available: true,
          sellingPrice: 5.0,
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/businessGoods/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(2);
    });

    it("returns a problem-details 400 for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/businessGoods/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).errors[0].path).toBe("businessId");
    });

    it("returns 404 when business has no goods", async () => {
      const app = await getTestApp();
      const emptyBusinessId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/businessGoods/business/${emptyBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  /**
   * Phase 5 Task 5.3: Cloudinary Integration Tests
   * These tests call the REAL Cloudinary API (requires valid credentials in .env)
   */
  const hasCloudinaryCredentials = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  describe.skipIf(!hasCloudinaryCredentials)("Cloudinary Integration - POST /api/v1/businessGoods", () => {
    it("creates business good with image uploads", async () => {
      const app = await getTestApp();

      // Create a simple PNG image buffer (1x1 pixel)
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );

      const form = new FormData();
      form.append("name", `Cloud Product ${Date.now()}`);
      form.append("keyword", `cloudproduct${Date.now()}`);
      form.append("mainCategory", "Food");
      form.append("onMenu", "true");
      form.append("available", "true");
      form.append("sellingPrice", "12.99");
      form.append("businessId", businessId.toString());
      form.append("images", new Blob([pngBuffer], { type: "image/png" }), "product.png");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(201);

      // Verify business good was created with image URL
      const created = await BusinessGood.findOne({ businessId }).sort({ _id: -1 }).lean();
      expect(created).not.toBeNull();
      expect(created?.imagesUrl).toBeDefined();
      expect(created?.imagesUrl?.length).toBeGreaterThan(0);
      expect(created?.imagesUrl?.[0]).toContain("cloudinary.com");
    });
  });

  describe.skipIf(!hasCloudinaryCredentials)("Cloudinary Integration - PATCH /api/v1/businessGoods/:businessGoodId", () => {
    it("updates business good with additional images", async () => {
      const app = await getTestApp();

      // Create business good first
      const businessGood = await BusinessGood.create({
        businessId,
        name: `Cloud Product ${Date.now()}`,
        keyword: `cloudproduct${Date.now()}`,
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 12.99,
        imagesUrl: ["https://existing-image.com/img.png"],
      });

      // Create a simple PNG image buffer (1x1 pixel)
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );

      const form = new FormData();
      form.append("name", businessGood.name);
      form.append("keyword", businessGood.keyword);
      form.append("mainCategory", "Food");
      form.append("onMenu", "true");
      form.append("available", "true");
      form.append("sellingPrice", "12.99");
      form.append("images", new Blob([pngBuffer], { type: "image/png" }), "additional.png");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/businessGoods/${businessGood._id}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(200);

      // Verify image was added
      const updated = await BusinessGood.findById(businessGood._id).lean();
      expect(updated?.imagesUrl?.length).toBe(2);
      expect(updated?.imagesUrl?.some((url: string) => url.includes("cloudinary.com"))).toBe(true);
    });
  });
});
