/**
 * SupplierGoods Routes Tests - Phase 1 Module 8 + Phase 4 Task 4.3 + Phase 5 Task 5.4
 *
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 * Phase 4: Full transaction tests for inventory sync (requires replica set).
 * Phase 5: Cloudinary tests for image uploads (skipped without credentials).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import Supplier from "../../src/models/supplier.ts";
import Business from "../../src/models/business.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import Inventory from "../../src/models/inventory.ts";

const isProblemDetails = (response: { headers: Record<string, unknown> }) =>
  String(response.headers["content-type"]).includes("application/problem+json");

const errorPaths = (response: { body: string }): string[] =>
  (JSON.parse(response.body).errors ?? []).map((e: { path: string }) => e.path);

const errorMessages = (response: { body: string }): string[] =>
  (JSON.parse(response.body).errors ?? []).map(
    (e: { message: string }) => e.message,
  );

const multipart = (fields: Record<string, string>): FormData => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
};

describe("SupplierGoods Routes", () => {
  let businessId: Types.ObjectId;
  let supplierId: Types.ObjectId;

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  const validGoodFields = () => ({
    name: "All Purpose Flour",
    keyword: "flour",
    mainCategory: "Food",
    supplierId: supplierId.toString(),
    businessId: businessId.toString(),
  });

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: "TAX-001",
      currencyTrade: "USD",
      address: validAddress,
    });
    businessId = business._id;

    const supplier = await Supplier.create({
      businessId,
      tradeName: "Test Supplier",
      legalName: "Test Supplier LLC",
      email: "supplier@test.com",
      phoneNumber: "9999999999",
      taxNumber: "SUP-001",
      currentlyInUse: true,
      address: validAddress,
    });
    supplierId = supplier._id;
  });

  describe("GET /api/v1/supplierGoods", () => {
    it("lists all supplier goods", async () => {
      const app = await getTestApp();

      await SupplierGood.create({
        businessId,
        supplierId,
        name: "Tomatoes",
        keyword: "tomato",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/supplierGoods",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].name).toBe("Tomatoes");
    });

    it("returns a problem-details 404 when no supplier goods exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/supplierGoods",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No supplier goods found!");
    });
  });

  describe("POST /api/v1/supplierGoods", () => {
    it("returns a problem-details 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: multipart({ name: "New Good" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("keyword");
      expect(errorPaths(response)).toContain("mainCategory");
    });

    it("returns a problem-details 400 for an invalid businessId or supplierId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: multipart({
          ...validGoodFields(),
          supplierId: "invalid-id",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierId");
    });

    it("returns a problem-details 400 for an invalid mainCategory", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: multipart({
          ...validGoodFields(),
          mainCategory: "InvalidCategory",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("mainCategory");
    });

    it("returns a problem-details 400 for an invalid allergen", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: multipart({
          ...validGoodFields(),
          allergens: JSON.stringify(["InvalidAllergen"]),
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("allergens.0");
    });

    it("returns a problem-details 400 for the server-owned imagesUrl field", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: multipart({
          ...validGoodFields(),
          imagesUrl: "https://example.com/good.png",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorMessages(response).some((m) => m.includes("imagesUrl"))).toBe(
        true,
      );
    });
  });

  describe("GET /api/v1/supplierGoods/:supplierGoodId", () => {
    it("gets supplier good by ID", async () => {
      const app = await getTestApp();

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Onions",
        keyword: "onion",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Onions");
    });

    it("returns a problem-details 400 for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/supplierGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierGoodId");
    });

    it("returns a problem-details 404 for a non-existent supplier good", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/supplierGoods/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("Supplier good not found!");
    });
  });

  describe("PATCH /api/v1/supplierGoods/:supplierGoodId", () => {
    it("returns a problem-details 400 for an invalid supplierGoodId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/supplierGoods/invalid-id",
        payload: multipart({ name: "Updated Name" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierGoodId");
    });

    it("returns a problem-details 400 for missing required fields", async () => {
      const app = await getTestApp();

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Original Good",
        keyword: "original",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
        payload: multipart({ name: "Updated Name" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("keyword");
      expect(errorPaths(response)).toContain("mainCategory");
      expect(errorPaths(response)).toContain("currentlyInUse");
    });

    it("returns a problem-details 400 for an invalid mainCategory on update", async () => {
      const app = await getTestApp();

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Original Good",
        keyword: "original",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
        payload: multipart({
          name: "Updated Name",
          keyword: "updated",
          mainCategory: "InvalidCategory",
          currentlyInUse: "true",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("mainCategory");
    });
  });

  describe("DELETE /api/v1/supplierGoods/:supplierGoodId", () => {
    it("returns a problem-details 400 for an invalid supplierGoodId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/supplierGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierGoodId");
    });

    it("returns a problem-details 409 when the good is in use in a business good", async () => {
      const app = await getTestApp();

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "In Use Good",
        keyword: "in use",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      await BusinessGood.create({
        businessId,
        name: "Flour Burger",
        keyword: "flour burger",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10,
        ingredients: [
          {
            supplierGoodId: supplierGood._id,
            measurementUnit: "kg",
            requiredQuantity: 1,
            costOfRequiredQuantity: 1,
          },
        ],
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
      });

      expect(response.statusCode).toBe(409);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toContain("in use");
    });
  });

  describe("GET /api/v1/supplierGoods/supplier/:supplierId", () => {
    it("lists supplier goods by supplier", async () => {
      const app = await getTestApp();

      await SupplierGood.create({
        businessId,
        supplierId,
        name: "Carrots",
        keyword: "carrot",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/supplierGoods/supplier/${supplierId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns a problem-details 400 for an invalid supplierId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/supplierGoods/supplier/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierId");
    });

    it("returns a problem-details 404 when no supplier goods exist for a supplier", async () => {
      const app = await getTestApp();
      const otherSupplierId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/supplierGoods/supplier/${otherSupplierId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No supplier goods found!");
    });
  });

  // Phase 4 Task 4.3: Transaction Tests for Inventory Sync
  describe("Transaction Tests - POST /api/v1/supplierGoods", () => {
    it("creates supplierGood and adds to inventory", async () => {
      const app = await getTestApp();

      // Create an inventory for current month first
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: multipart(validGoodFields()),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");

      // Verify supplierGood was created
      const createdSupplierGood = await SupplierGood.findOne({
        businessId,
        name: "All Purpose Flour",
      }).lean();
      expect(createdSupplierGood).not.toBeNull();

      // Verify supplierGood was added to inventory
      const inventory = await Inventory.findOne({ businessId }).lean();
      expect(inventory).not.toBeNull();

      const hasSupplierGood = inventory?.inventoryGoods?.some(
        (g: { supplierGoodId: { toString: () => string } }) =>
          g.supplierGoodId.toString() === createdSupplierGood?._id?.toString(),
      );
      expect(hasSupplierGood).toBe(true);
    });

    it("prevents duplicate supplierGood creation", async () => {
      const app = await getTestApp();

      // Create existing supplierGood
      await SupplierGood.create({
        businessId,
        supplierId,
        name: "All Purpose Flour",
        keyword: "flour",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: multipart(validGoodFields()),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toContain("already exists");
    });
  });

  describe("Transaction Tests - PATCH /api/v1/supplierGoods/:supplierGoodId", () => {
    it("updates supplierGood and adds to inventory if currentlyInUse", async () => {
      const app = await getTestApp();

      // Create inventory
      await Inventory.create({
        businessId,
        setFinalCount: false,
        inventoryGoods: [],
      });

      // Create supplierGood with currentlyInUse = false (not in inventory)
      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Inactive Good",
        keyword: "inactive",
        mainCategory: "Food",
        currentlyInUse: false,
      });

      // Update to currentlyInUse = true
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
        payload: multipart({
          name: "Inactive Good",
          keyword: "inactive",
          mainCategory: "Food",
          currentlyInUse: "true",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("updated");

      // Verify supplierGood was added to inventory
      const inventory = await Inventory.findOne({ businessId }).lean();
      const hasSupplierGood = inventory?.inventoryGoods?.some(
        (g: { supplierGoodId: { toString: () => string } }) =>
          g.supplierGoodId.toString() === supplierGood._id.toString(),
      );
      expect(hasSupplierGood).toBe(true);
    });
  });

  /**
   * Phase 5 Task 5.4: Cloudinary Integration Tests
   * These tests call the REAL Cloudinary API (requires valid credentials in .env)
   */
  const hasCloudinaryCredentials = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

  describe.skipIf(!hasCloudinaryCredentials)(
    "Cloudinary Integration - POST /api/v1/supplierGoods",
    () => {
      it("creates supplierGood with image uploads", async () => {
        const app = await getTestApp();

        // Create an inventory first (required by the route)
        await Inventory.create({
          businessId,
          setFinalCount: false,
          inventoryGoods: [],
        });

        // Create a simple PNG image buffer (1x1 pixel)
        const pngBuffer = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        );

        const form = multipart({
          ...validGoodFields(),
          name: `Cloud Ingredient ${Date.now()}`,
          keyword: `cloudingredient${Date.now()}`,
        });
        form.append(
          "images",
          new Blob([pngBuffer], { type: "image/png" }),
          "ingredient.png",
        );

        const response = await app.inject({
          method: "POST",
          url: "/api/v1/supplierGoods",
          payload: form,
          headers: { "content-type": "multipart/form-data" },
        });

        expect(response.statusCode).toBe(201);

        // Verify supplierGood was created with image URL
        const created = await SupplierGood.findOne({ businessId })
          .sort({ _id: -1 })
          .lean();
        expect(created).not.toBeNull();
        expect(created?.imagesUrl).toBeDefined();
        expect(created?.imagesUrl?.length).toBeGreaterThan(0);
        expect(created?.imagesUrl?.[0]).toContain("cloudinary.com");
      });
    },
  );

  describe.skipIf(!hasCloudinaryCredentials)(
    "Cloudinary Integration - PATCH /api/v1/supplierGoods/:supplierGoodId",
    () => {
      it("updates supplierGood with additional images", async () => {
        const app = await getTestApp();

        // Create supplier good first
        const supplierGood = await SupplierGood.create({
          businessId,
          supplierId,
          name: `Cloud Ingredient ${Date.now()}`,
          keyword: `cloudingredient${Date.now()}`,
          mainCategory: "Food",
          currentlyInUse: true,
          imagesUrl: ["https://existing-image.com/img.png"],
        });

        // Create an inventory (required by PATCH when currentlyInUse is true)
        await Inventory.create({
          businessId,
          setFinalCount: false,
          inventoryGoods: [
            {
              supplierGoodId: supplierGood._id,
              currentCountQuantity: 0,
              dynamicCountQuantity: 0,
            },
          ],
        });

        // Create a simple PNG image buffer
        const pngBuffer = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64",
        );

        const form = multipart({
          name: supplierGood.name,
          keyword: supplierGood.keyword,
          mainCategory: "Food",
          currentlyInUse: "true",
        });
        form.append(
          "images",
          new Blob([pngBuffer], { type: "image/png" }),
          "additional.png",
        );

        const response = await app.inject({
          method: "PATCH",
          url: `/api/v1/supplierGoods/${supplierGood._id}`,
          payload: form,
          headers: { "content-type": "multipart/form-data" },
        });

        expect(response.statusCode).toBe(200);

        // Verify image was added
        const updated = await SupplierGood.findById(supplierGood._id).lean();
        expect(updated?.imagesUrl?.length).toBe(2);
        expect(
          updated?.imagesUrl?.some((url: string) =>
            url.includes("cloudinary.com"),
          ),
        ).toBe(true);
      });
    },
  );
});
