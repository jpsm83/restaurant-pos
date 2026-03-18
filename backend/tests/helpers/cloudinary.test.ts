/**
 * Cloudinary Helpers Tests - Task 0.3
 * Tests for uploadFilesCloudinary and deleteFilesCloudinary (mocked)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock cloudinary before importing the modules
vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

import { v2 as cloudinary } from "cloudinary";
import { uploadFilesCloudinary } from "../../src/cloudinary/uploadFilesCloudinary.js";
import { deleteFilesCloudinary } from "../../src/cloudinary/deleteFilesCloudinary.js";

describe("Cloudinary Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadFilesCloudinary", () => {
    it("uploads files successfully and returns URLs", async () => {
      const mockUrl = "https://res.cloudinary.com/test/image/upload/v1/restaurant-pos/test.jpg";
      vi.mocked(cloudinary.uploader.upload).mockResolvedValue({
        secure_url: mockUrl,
      } as any);

      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [
          { buffer: Buffer.from("test"), mimeType: "image/jpeg" },
        ],
      });

      expect(result).toEqual([mockUrl]);
      expect(cloudinary.uploader.upload).toHaveBeenCalledTimes(1);
    });

    it("uploads multiple files and returns array of URLs", async () => {
      const mockUrl1 = "https://res.cloudinary.com/test/image/upload/v1/restaurant-pos/test1.jpg";
      const mockUrl2 = "https://res.cloudinary.com/test/image/upload/v1/restaurant-pos/test2.jpg";
      
      vi.mocked(cloudinary.uploader.upload)
        .mockResolvedValueOnce({ secure_url: mockUrl1 } as any)
        .mockResolvedValueOnce({ secure_url: mockUrl2 } as any);

      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [
          { buffer: Buffer.from("test1"), mimeType: "image/jpeg" },
          { buffer: Buffer.from("test2"), mimeType: "image/png" },
        ],
      });

      expect(result).toEqual([mockUrl1, mockUrl2]);
      expect(cloudinary.uploader.upload).toHaveBeenCalledTimes(2);
    });

    it("rejects non-image files when onlyImages is true", async () => {
      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [
          { buffer: Buffer.from("test"), mimeType: "application/pdf" },
        ],
        onlyImages: true,
      });

      expect(result).toBe("Only images can be uploaded!");
      expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    });

    it("allows non-image files when onlyImages is false", async () => {
      const mockUrl = "https://res.cloudinary.com/test/raw/upload/v1/restaurant-pos/doc.pdf";
      vi.mocked(cloudinary.uploader.upload).mockResolvedValue({
        secure_url: mockUrl,
      } as any);

      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [
          { buffer: Buffer.from("test"), mimeType: "application/pdf" },
        ],
        onlyImages: false,
      });

      expect(result).toEqual([mockUrl]);
    });

    it("returns error message on upload failure", async () => {
      vi.mocked(cloudinary.uploader.upload).mockRejectedValue(
        new Error("Upload failed")
      );

      const result = await uploadFilesCloudinary({
        folder: "/test",
        filesArr: [
          { buffer: Buffer.from("test"), mimeType: "image/jpeg" },
        ],
      });

      expect(result).toBe("Error trying to upload images: Upload failed");
    });
  });

  describe("deleteFilesCloudinary", () => {
    it("deletes file successfully and returns true", async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({
        result: "ok",
      } as any);

      const result = await deleteFilesCloudinary(
        "https://res.cloudinary.com/test/image/upload/v1/restaurant-pos/folder/image.jpg"
      );

      expect(result).toBe(true);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        "restaurant-pos/folder/image",
        { resource_type: "image" }
      );
    });

    it("returns true when imageUrl is undefined", async () => {
      const result = await deleteFilesCloudinary(undefined);

      expect(result).toBe(true);
      expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    });

    it("returns error message when deletion fails", async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({
        result: "not found",
      } as any);

      const result = await deleteFilesCloudinary(
        "https://res.cloudinary.com/test/image/upload/v1/restaurant-pos/folder/image.jpg"
      );

      expect(result).toBe("DeleteCloudinaryImage failed!");
    });

    it("returns error message on exception", async () => {
      vi.mocked(cloudinary.uploader.destroy).mockRejectedValue(
        new Error("Network error")
      );

      const result = await deleteFilesCloudinary(
        "https://res.cloudinary.com/test/image/upload/v1/restaurant-pos/folder/image.jpg"
      );

      expect(result).toBe("Error trying to upload image: Network error");
    });
  });
});
