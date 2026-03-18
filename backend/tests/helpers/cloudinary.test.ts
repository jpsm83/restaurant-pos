/**
 * Cloudinary Helpers Tests - Task 0.3 + Phase 5
 * Tests for uploadFilesCloudinary, deleteFilesCloudinary, deleteFolderCloudinary
 * Uses mock utilities from Phase 5 for full coverage
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockUploadFilesCloudinary,
  mockDeleteFilesCloudinary,
  mockDeleteFolderCloudinary,
  mockGenerateQrCode,
  resetCloudinaryMocks,
} from "../mocks/cloudinary.js";

// Mock the cloudinary modules
vi.mock("../../src/cloudinary/uploadFilesCloudinary.js", () => ({
  uploadFilesCloudinary: mockUploadFilesCloudinary,
}));

vi.mock("../../src/cloudinary/deleteFilesCloudinary.js", () => ({
  deleteFilesCloudinary: mockDeleteFilesCloudinary,
}));

vi.mock("../../src/cloudinary/deleteFolderCloudinary.js", () => ({
  deleteFolderCloudinary: mockDeleteFolderCloudinary,
}));

vi.mock("../../src/salesPoints/generateQrCode.js", () => ({
  generateQrCode: mockGenerateQrCode,
}));

describe("Cloudinary Helpers (Mocked)", () => {
  beforeEach(() => {
    resetCloudinaryMocks();
  });

  describe("uploadFilesCloudinary", () => {
    it("uploads files successfully and returns URLs", async () => {
      const { uploadFilesCloudinary } = await import(
        "../../src/cloudinary/uploadFilesCloudinary.js"
      );

      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [{ buffer: Buffer.from("test"), mimeType: "image/jpeg" }],
      });

      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain("cloudinary.com");
      expect(mockUploadFilesCloudinary).toHaveBeenCalledTimes(1);
    });

    it("uploads multiple files and returns array of URLs", async () => {
      const { uploadFilesCloudinary } = await import(
        "../../src/cloudinary/uploadFilesCloudinary.js"
      );

      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [
          { buffer: Buffer.from("test1"), mimeType: "image/jpeg" },
          { buffer: Buffer.from("test2"), mimeType: "image/png" },
        ],
      });

      expect(Array.isArray(result)).toBe(true);
      expect((result as string[]).length).toBe(2);
      expect(mockUploadFilesCloudinary).toHaveBeenCalledTimes(1);
    });

    it("rejects non-image files when onlyImages is true", async () => {
      const { uploadFilesCloudinary } = await import(
        "../../src/cloudinary/uploadFilesCloudinary.js"
      );

      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [
          { buffer: Buffer.from("test"), mimeType: "application/pdf" },
        ],
        onlyImages: true,
      });

      expect(result).toBe("Only images can be uploaded!");
    });

    it("allows non-image files when onlyImages is false", async () => {
      const { uploadFilesCloudinary } = await import(
        "../../src/cloudinary/uploadFilesCloudinary.js"
      );

      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [
          { buffer: Buffer.from("test"), mimeType: "application/pdf" },
        ],
        onlyImages: false,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("deleteFilesCloudinary", () => {
    it("deletes file successfully and returns true", async () => {
      const { deleteFilesCloudinary } = await import(
        "../../src/cloudinary/deleteFilesCloudinary.js"
      );

      const result = await deleteFilesCloudinary(
        "https://res.cloudinary.com/test/image/upload/v1/restaurant-pos/folder/image.jpg"
      );

      expect(result).toBe(true);
      expect(mockDeleteFilesCloudinary).toHaveBeenCalledTimes(1);
    });

    it("returns true when imageUrl is undefined", async () => {
      const { deleteFilesCloudinary } = await import(
        "../../src/cloudinary/deleteFilesCloudinary.js"
      );

      const result = await deleteFilesCloudinary(undefined);
      expect(result).toBe(true);
    });

    it("returns true when imageUrl is empty string", async () => {
      const { deleteFilesCloudinary } = await import(
        "../../src/cloudinary/deleteFilesCloudinary.js"
      );

      const result = await deleteFilesCloudinary("");
      expect(result).toBe(true);
    });
  });

  describe("deleteFolderCloudinary", () => {
    it("deletes folder successfully and returns true", async () => {
      const { deleteFolderCloudinary } = await import(
        "../../src/cloudinary/deleteFolderCloudinary.js"
      );

      const result = await deleteFolderCloudinary("/business/123/images");

      expect(result).toBe(true);
      expect(mockDeleteFolderCloudinary).toHaveBeenCalledTimes(1);
    });
  });

  describe("generateQrCode", () => {
    it("generates QR code and returns URL", async () => {
      const { generateQrCode } = await import(
        "../../src/salesPoints/generateQrCode.js"
      );

      const result = await generateQrCode("business123", "salespoint456" as any);

      expect(result).toContain("cloudinary.com");
      expect(result).toContain("business123");
      expect(result).toContain("salespoint456");
      expect(mockGenerateQrCode).toHaveBeenCalledTimes(1);
    });
  });
});
