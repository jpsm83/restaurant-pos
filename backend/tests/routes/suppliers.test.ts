/**
 * Suppliers Routes Tests - Phase 1 Module 7
 *
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, resetTestApp } from "../setup.ts";
import Supplier from "../../src/models/supplier.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import Business from "../../src/models/business.ts";
import { multipart } from "../helpers/multipart.ts";
import {
  errorMessages,
  errorPaths,
  isProblemDetails,
} from "../helpers/problemDetails.ts";

const deleteFolderCloudinaryMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(true),
);

vi.mock("../../src/cloudinary/deleteFolderCloudinary.ts", () => ({
  default: deleteFolderCloudinaryMock,
}));

describe("Suppliers Routes", () => {
  let businessId: Types.ObjectId;

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  const validSupplierFields = () => ({
    tradeName: "Test Supplier",
    legalName: "Test Supplier LLC",
    email: "test@supplier.com",
    phoneNumber: "9999999999",
    taxNumber: "TAX-999",
    currentlyInUse: "true",
    address: JSON.stringify(validAddress),
    businessId: businessId.toString(),
  });

  beforeAll(async () => {
    await resetTestApp();
  });

  afterAll(async () => {
    await resetTestApp();
  });

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      phoneNumber: "1234567890",
      taxNumber: "TAX-001",
      currencyTrade: "USD",
      address: validAddress,
    });
    businessId = business._id;
  });

  describe("GET /api/v1/suppliers", () => {
    it("lists only active suppliers by default", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Supplier A",
        legalName: "Supplier A LLC",
        email: "suppliera@test.com",
        phoneNumber: "1111111111",
        taxNumber: "SUP-001",
        currentlyInUse: true,
        address: validAddress,
      });
      await Supplier.create({
        businessId,
        tradeName: "Supplier Deleted",
        legalName: "Supplier Deleted LLC",
        email: "supplierdeleted@test.com",
        phoneNumber: "9990009999",
        taxNumber: "SUP-DEL-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].tradeName).toBe("Supplier A");
    });

    it("includes deleted suppliers when includeDeleted=true", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Supplier A",
        legalName: "Supplier A LLC",
        email: "suppliera@test.com",
        phoneNumber: "1111111111",
        taxNumber: "SUP-001",
        currentlyInUse: true,
        address: validAddress,
      });
      await Supplier.create({
        businessId,
        tradeName: "Supplier Deleted",
        legalName: "Supplier Deleted LLC",
        email: "supplierdeleted@test.com",
        phoneNumber: "9990009999",
        taxNumber: "SUP-DEL-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers?includeDeleted=true",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.some((supplier: { deleted?: boolean }) => supplier.deleted)).toBe(
        true,
      );
    });

    it("returns a problem-details 404 when no suppliers exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No suppliers found!");
    });

    it("returns a problem-details 400 for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers?includeDeleted=maybe",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("includeDeleted");
    });
  });

  describe("POST /api/v1/suppliers", () => {
    it("returns a problem-details 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({ tradeName: "Test Supplier" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("legalName");
    });

    it("returns a problem-details 400 for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({
          ...validSupplierFields(),
          businessId: "invalid-id",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
    });

    it("returns a problem-details 400 for an invalid email", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({ ...validSupplierFields(), email: "invalid-email" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("email");
    });

    it("returns a problem-details 400 for an invalid address", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({
          ...validSupplierFields(),
          address: JSON.stringify({ country: "USA" }),
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("address.city");
    });

    it("returns a problem-details 400 for the server-owned imageUrl field", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({
          ...validSupplierFields(),
          imageUrl: "https://example.com/logo.png",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorMessages(response).some((m) => m.includes("imageUrl"))).toBe(
        true,
      );
    });

    it("returns a problem-details 400 for reserved 'One Time Purchase' values", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({
          ...validSupplierFields(),
          tradeName: "One Time Purchase",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toContain("One Time Purchase");
    });

    it("returns a problem-details 409 for a duplicate supplier", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Existing Supplier",
        legalName: "Existing Supplier LLC",
        email: "existing@supplier.com",
        phoneNumber: "8888888888",
        taxNumber: "EXIST-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({
          ...validSupplierFields(),
          legalName: "Existing Supplier LLC",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(409);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toContain("already exists");
    });

    it("creates a supplier when only a soft-deleted supplier has matching identity fields", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Old Supplier",
        legalName: "Existing Supplier LLC",
        email: "existing@supplier.com",
        phoneNumber: "8888888888",
        taxNumber: "EXIST-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({
          ...validSupplierFields(),
          legalName: "Existing Supplier LLC",
          email: "existing@supplier.com",
          taxNumber: "EXIST-001",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body).message).toBe(
        "Supplier Existing Supplier LLC created successfully!",
      );
    });

    it("creates a supplier, normalizing the email and parsing the address", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/suppliers",
        payload: multipart({
          ...validSupplierFields(),
          tradeName: "  <b>Fresh</b>   Foods ",
          email: "Sales@FreshFoods.com",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body).message).toBe(
        "Supplier Test Supplier LLC created successfully!",
      );

      const created = await Supplier.findOne({ taxNumber: "TAX-999" }).lean();
      expect(created?.email).toBe("sales@freshfoods.com");
      expect(created?.tradeName).toBe("Fresh Foods");
      expect(created?.address?.city).toBe("Los Angeles");
    });
  });

  describe("GET /api/v1/suppliers/:supplierId", () => {
    it("gets supplier by ID", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Supplier B",
        legalName: "Supplier B LLC",
        email: "supplierb@test.com",
        phoneNumber: "2222222222",
        taxNumber: "SUP-002",
        currentlyInUse: true,
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tradeName).toBe("Supplier B");
    });

    it("returns a problem-details 400 for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierId");
    });

    it("returns a problem-details 404 for a non-existent supplier", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No suppliers found!");
    });

    it("returns a problem-details 404 for a soft-deleted supplier by default", async () => {
      const app = await getTestApp();
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Soft Deleted Supplier",
        legalName: "Soft Deleted Supplier LLC",
        email: "softdeleted@supplier.com",
        phoneNumber: "1111112222",
        taxNumber: "SUP-SOFT-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No suppliers found!");
    });

    it("returns a soft-deleted supplier when includeDeleted=true", async () => {
      const app = await getTestApp();
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Soft Deleted Supplier",
        legalName: "Soft Deleted Supplier LLC",
        email: "softdeleted@supplier.com",
        phoneNumber: "1111112222",
        taxNumber: "SUP-SOFT-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/${supplier._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deleted).toBe(true);
    });
  });

  describe("PATCH /api/v1/suppliers/:supplierId", () => {
    it("returns a problem-details 400 for an invalid supplierId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/suppliers/invalid-id",
        payload: multipart({ tradeName: "Updated Name" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierId");
    });

    it("returns a problem-details 400 for missing required fields on update", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Original Supplier",
        legalName: "Original Supplier LLC",
        email: "original@supplier.com",
        phoneNumber: "3333333333",
        taxNumber: "ORIG-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/suppliers/${supplier._id}`,
        payload: multipart({ tradeName: "Updated Name" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("legalName");
    });

    it("returns a problem-details 404 for a non-existent supplier", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const { businessId: _omit, ...updateFields } = validSupplierFields();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/suppliers/${fakeId}`,
        payload: multipart(updateFields),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("Supplier not found!");
    });

    it("updates a supplier and toggles currentlyInUse off", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Original Supplier",
        legalName: "Original Supplier LLC",
        email: "original@supplier.com",
        phoneNumber: "3333333333",
        taxNumber: "ORIG-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const { businessId: _omit, ...updateFields } = validSupplierFields();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/suppliers/${supplier._id}`,
        payload: multipart({
          ...updateFields,
          tradeName: "Updated Supplier",
          currentlyInUse: "false",
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toBe(
        "Supplier updated successfully!",
      );

      const updated = await Supplier.findById(supplier._id).lean();
      expect(updated?.tradeName).toBe("Updated Supplier");
      expect(updated?.currentlyInUse).toBe(false);
    });

    it("preserves address fields not changed by the update", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Original Supplier",
        legalName: "Original Supplier LLC",
        email: "original@supplier.com",
        phoneNumber: "3333333333",
        taxNumber: "ORIG-001",
        currentlyInUse: true,
        address: { ...validAddress, region: "West" },
      });

      const { businessId: _omit, ...updateFields } = validSupplierFields();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/suppliers/${supplier._id}`,
        payload: multipart({
          ...updateFields,
          address: JSON.stringify({ ...validAddress, city: "San Diego" }),
        }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(200);

      const updated = await Supplier.findById(supplier._id).lean();
      expect(updated?.address?.city).toBe("San Diego");
      expect(updated?.address?.country).toBe("USA");
      expect(updated?.address?.street).toBe("Main St");
      expect(updated?.address?.postCode).toBe("90001");
      expect(updated?.address?.region).toBe("West");
    });
  });

  describe("DELETE /api/v1/suppliers/:supplierId", () => {
    it("returns a problem-details 400 for an invalid supplierId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/suppliers/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("supplierId");
    });

    it("returns a problem-details 404 for a non-existent supplier", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/suppliers/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("Supplier not found!");
    });

    it("returns a problem-details 409 when the supplier's goods are in use", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "In Use Supplier",
        legalName: "In Use Supplier LLC",
        email: "inuse@supplier.com",
        phoneNumber: "6666666666",
        taxNumber: "INUSE-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId: supplier._id,
        name: "Flour",
        keyword: "flour",
        mainCategory: "Food",
      });

      await BusinessGood.create({
        businessId,
        name: "Bread",
        keyword: "bread",
        mainCategory: "Food",
        sellingPrice: 5,
        ingredients: [
          {
            supplierGoodId: supplierGood._id,
            measurementUnit: "g",
            requiredQuantity: 500,
          },
        ],
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(409);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe(
        "Supplier is in use in some business goods!",
      );
    });

    it("ignores soft-deleted business goods in the in-use guard", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "In Use Supplier",
        legalName: "In Use Supplier LLC",
        email: "inuse-softdeleted@supplier.com",
        phoneNumber: "6666666667",
        taxNumber: "INUSE-002",
        currentlyInUse: true,
        address: validAddress,
      });

      const supplierGood = await SupplierGood.create({
        businessId,
        supplierId: supplier._id,
        name: "Flour",
        keyword: "flour",
        mainCategory: "Food",
      });

      await BusinessGood.create({
        businessId,
        name: "Deleted Bread",
        keyword: "deleted-bread",
        mainCategory: "Food",
        sellingPrice: 5,
        ingredients: [
          {
            supplierGoodId: supplierGood._id,
            measurementUnit: "g",
            requiredQuantity: 500,
          },
        ],
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toBe(
        "Supplier deleted successfully!",
      );

      const persisted = await Supplier.findById(supplier._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(persisted?.deleted).toBe(true);
    });

    it("soft-deletes a supplier instead of hard-deleting", async () => {
      const app = await getTestApp();

      const supplier = await Supplier.create({
        businessId,
        tradeName: "Delete Me Supplier",
        legalName: "Delete Me Supplier LLC",
        email: "deleteme@supplier.com",
        phoneNumber: "6677778888",
        taxNumber: "SOFT-DEL-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).message).toBe(
        "Supplier deleted successfully!",
      );

      const persisted = await Supplier.findById(supplier._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(persisted).not.toBeNull();
      expect(persisted?.deleted).toBe(true);
      expect(persisted?.deletedAt).toBeInstanceOf(Date);
      expect(deleteFolderCloudinaryMock).not.toHaveBeenCalled();
    });

    it("returns a problem-details 409 when supplier is already soft-deleted", async () => {
      const app = await getTestApp();
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Delete Me Supplier",
        legalName: "Delete Me Supplier LLC",
        email: "deleteme@supplier.com",
        phoneNumber: "6677778888",
        taxNumber: "SOFT-DEL-001",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(response.statusCode).toBe(409);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("Supplier already deleted!");
    });

    it("returns 409 on a second delete after a successful soft-delete", async () => {
      const app = await getTestApp();
      const supplier = await Supplier.create({
        businessId,
        tradeName: "Delete Me Supplier",
        legalName: "Delete Me Supplier LLC",
        email: "deleteme@supplier.com",
        phoneNumber: "6677778888",
        taxNumber: "SOFT-DEL-001",
        currentlyInUse: true,
        address: validAddress,
      });

      const firstDelete = await app.inject({
        method: "DELETE",
        url: `/api/v1/suppliers/${supplier._id}`,
      });
      expect(firstDelete.statusCode).toBe(200);

      const secondDelete = await app.inject({
        method: "DELETE",
        url: `/api/v1/suppliers/${supplier._id}`,
      });

      expect(secondDelete.statusCode).toBe(409);
      expect(isProblemDetails(secondDelete)).toBe(true);
      expect(JSON.parse(secondDelete.body).detail).toBe(
        "Supplier already deleted!",
      );
    });
  });

  describe("GET /api/v1/suppliers/business/:businessId", () => {
    it("lists active suppliers by business by default", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Supplier C",
        legalName: "Supplier C LLC",
        email: "supplierc@test.com",
        phoneNumber: "5555555555",
        taxNumber: "SUP-003",
        currentlyInUse: true,
        address: validAddress,
      });
      await Supplier.create({
        businessId,
        tradeName: "Supplier Deleted",
        legalName: "Supplier Deleted LLC",
        email: "supplierdeleted@test.com",
        phoneNumber: "0000011111",
        taxNumber: "SUP-DEL-003",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("lists deleted suppliers by business when includeDeleted=true", async () => {
      const app = await getTestApp();

      await Supplier.create({
        businessId,
        tradeName: "Supplier C",
        legalName: "Supplier C LLC",
        email: "supplierc@test.com",
        phoneNumber: "5555555555",
        taxNumber: "SUP-003",
        currentlyInUse: true,
        address: validAddress,
      });
      await Supplier.create({
        businessId,
        tradeName: "Supplier Deleted",
        legalName: "Supplier Deleted LLC",
        email: "supplierdeleted@test.com",
        phoneNumber: "0000011111",
        taxNumber: "SUP-DEL-003",
        currentlyInUse: true,
        address: validAddress,
        deleted: true,
        deletedAt: new Date(),
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/business/${businessId}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(2);
    });

    it("returns a problem-details 400 for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/suppliers/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("businessId");
    });

    it("returns a problem-details 404 when the business has no suppliers", async () => {
      const app = await getTestApp();
      const otherBusinessId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/suppliers/business/${otherBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(JSON.parse(response.body).detail).toBe("No suppliers found!");
    });
  });
});
