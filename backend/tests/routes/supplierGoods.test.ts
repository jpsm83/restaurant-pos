/**
 * SupplierGoods Routes Tests - Phase 1 Module 8 + Phase 4 Task 4.3 + Phase 5 Task 5.4
 * Tests for supplier goods CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests for inventory sync (requires replica set)
 * Phase 5: Cloudinary tests for image uploads (skipped - ESM mocking limitation)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import SupplierGood from "../../src/models/supplierGood.js";
import Supplier from "../../src/models/supplier.js";
import Business from "../../src/models/business.js";
import Inventory from "../../src/models/inventory.js";

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

    it("returns 404 when no supplier goods exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/supplierGoods",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No supplier goods found!!");
    });
  });

  describe("POST /api/v1/supplierGoods", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("name", "New Good");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for invalid businessId or supplierId", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("name", "New Good");
      form.append("keyword", "good");
      form.append("mainCategory", "Food");
      form.append("supplierId", "invalid-id");
      form.append("businessId", businessId.toString());

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business or supplier ID is not valid!");
    });

    it("returns 400 for invalid mainCategory", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("name", "New Good");
      form.append("keyword", "good");
      form.append("mainCategory", "InvalidCategory");
      form.append("supplierId", supplierId.toString());
      form.append("businessId", businessId.toString());

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid main category!");
    });

    it("returns 400 for invalid allergen", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("name", "New Good");
      form.append("keyword", "good");
      form.append("mainCategory", "Food");
      form.append("supplierId", supplierId.toString());
      form.append("businessId", businessId.toString());
      form.append("allergens", JSON.stringify(["InvalidAllergen"]));

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid allergen!");
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

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/supplierGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid supplierGoodId!");
    });

    it("returns 404 for non-existent supplier good", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/supplierGoods/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Supplier good not found!");
    });
  });

  describe("PATCH /api/v1/supplierGoods/:supplierGoodId", () => {
    it("returns 400 for invalid supplierGoodId", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("name", "Updated Name");

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/supplierGoods/invalid-id",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid supplierGoodId!");
    });

    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Original Good",
        keyword: "original",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const form = new FormData();
      form.append("name", "Updated Name");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for invalid mainCategory on update", async () => {
      const app = await getTestApp();

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId,
        name: "Original Good",
        keyword: "original",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const form = new FormData();
      form.append("name", "Updated Name");
      form.append("keyword", "updated");
      form.append("mainCategory", "InvalidCategory");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid main category!");
    });
  });

  describe("DELETE /api/v1/supplierGoods/:supplierGoodId", () => {
    it("returns 400 for invalid supplierGoodId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/supplierGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid supplierGoodId!");
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

    it("returns 400 for invalid supplierId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/supplierGoods/supplier/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid supplierId!");
    });

    it("returns 404 when no supplier goods for supplier", async () => {
      const app = await getTestApp();
      const otherSupplierId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/supplierGoods/supplier/${otherSupplierId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No supplier goods found!");
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

      const form = new FormData();
      form.append("name", "Test Ingredient");
      form.append("keyword", "ingredient");
      form.append("mainCategory", "Food");
      form.append("supplierId", supplierId.toString());
      form.append("businessId", businessId.toString());

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");

      // Verify supplierGood was created
      const createdSupplierGood = await SupplierGood.findOne({
        businessId,
        name: "Test Ingredient",
      }).lean();
      expect(createdSupplierGood).not.toBeNull();

      // Verify supplierGood was added to inventory
      const inventory = await Inventory.findOne({ businessId }).lean();
      expect(inventory).not.toBeNull();

      const hasSupplierGood = inventory?.inventoryGoods?.some(
        (g) => g.supplierGoodId.toString() === createdSupplierGood?._id?.toString()
      );
      expect(hasSupplierGood).toBe(true);
    });

    it("prevents duplicate supplierGood creation", async () => {
      const app = await getTestApp();

      // Create existing supplierGood
      await SupplierGood.create({
        businessId,
        supplierId,
        name: "Duplicate Good",
        keyword: "duplicate",
        mainCategory: "Food",
        currentlyInUse: true,
      });

      const form = new FormData();
      form.append("name", "Duplicate Good");
      form.append("keyword", "duplicate");
      form.append("mainCategory", "Food");
      form.append("supplierId", supplierId.toString());
      form.append("businessId", businessId.toString());

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("already exists");
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
      const form = new FormData();
      form.append("name", "Inactive Good");
      form.append("keyword", "inactive");
      form.append("mainCategory", "Food");
      form.append("currentlyInUse", "true");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/supplierGoods/${supplierGood._id}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("updated");

      // Verify supplierGood was added to inventory
      const inventory = await Inventory.findOne({ businessId }).lean();
      const hasSupplierGood = inventory?.inventoryGoods?.some(
        (g) => g.supplierGoodId.toString() === supplierGood._id.toString()
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
    process.env.CLOUDINARY_API_SECRET
  );

  describe.skipIf(!hasCloudinaryCredentials)("Cloudinary Integration - POST /api/v1/supplierGoods", () => {
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
        "base64"
      );

      const form = new FormData();
      form.append("name", `Cloud Ingredient ${Date.now()}`);
      form.append("keyword", `cloudingredient${Date.now()}`);
      form.append("mainCategory", "Food");
      form.append("supplierId", supplierId.toString());
      form.append("businessId", businessId.toString());
      form.append("images", new Blob([pngBuffer], { type: "image/png" }), "ingredient.png");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/supplierGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(201);

      // Verify supplierGood was created with image URL
      const created = await SupplierGood.findOne({ businessId }).sort({ _id: -1 }).lean();
      expect(created).not.toBeNull();
      expect(created?.imagesUrl).toBeDefined();
      expect(created?.imagesUrl?.length).toBeGreaterThan(0);
      expect(created?.imagesUrl?.[0]).toContain("cloudinary.com");
    });
  });

  describe.skipIf(!hasCloudinaryCredentials)("Cloudinary Integration - PATCH /api/v1/supplierGoods/:supplierGoodId", () => {
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
        inventoryGoods: [{
          supplierGoodId: supplierGood._id,
          currentCountQuantity: 0,
          dynamicCountQuantity: 0,
        }],
      });

      // Create a simple PNG image buffer
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );

      const form = new FormData();
      form.append("name", supplierGood.name);
      form.append("keyword", supplierGood.keyword);
      form.append("mainCategory", "Food");
      form.append("currentlyInUse", "true");
      form.append("images", new Blob([pngBuffer], { type: "image/png" }), "additional.png");

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
      expect(updated?.imagesUrl?.some((url: string) => url.includes("cloudinary.com"))).toBe(true);
    });
  });
});
