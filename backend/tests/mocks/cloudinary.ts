/**
 * Cloudinary Mock Utilities for Testing
 * Phase 5: Provides mock implementations for Cloudinary-dependent functions
 */

import { vi } from "vitest";

const MOCK_CLOUDINARY_URL = "https://res.cloudinary.com/test/image/upload/v1/restaurant-pos";

/**
 * Mock response for successful file upload
 */
export const mockUploadResponse = (filename: string = "test-image") => ({
  secure_url: `${MOCK_CLOUDINARY_URL}/${filename}.jpg`,
  public_id: `restaurant-pos/${filename}`,
  version: "1234567890",
  signature: "mock-signature",
  width: 800,
  height: 600,
  format: "jpg",
  resource_type: "image",
  created_at: new Date().toISOString(),
  bytes: 12345,
  type: "upload",
  url: `http://res.cloudinary.com/test/image/upload/v1/restaurant-pos/${filename}.jpg`,
});

/**
 * Mock response for successful deletion
 */
export const mockDestroyResponse = () => ({
  result: "ok",
});

/**
 * Mock response for failed deletion
 */
export const mockDestroyFailedResponse = () => ({
  result: "not found",
});

/**
 * Create mock implementations for cloudinary v2 module
 */
export const createCloudinaryMock = () => ({
  config: vi.fn(),
  uploader: {
    upload: vi.fn().mockResolvedValue(mockUploadResponse()),
    destroy: vi.fn().mockResolvedValue(mockDestroyResponse()),
  },
  api: {
    delete_resources_by_prefix: vi.fn().mockResolvedValue({ deleted: {} }),
    delete_folder: vi.fn().mockResolvedValue({ deleted: [] }),
  },
});

/**
 * Mock for uploadFilesCloudinary function
 */
export const mockUploadFilesCloudinary = vi.fn().mockImplementation(
  async (params: { folder: string; filesArr: { buffer: Buffer; mimeType: string }[]; onlyImages?: boolean }) => {
    if (params.onlyImages) {
      for (const f of params.filesArr) {
        if (!f.mimeType.startsWith("image/")) {
          return "Only images can be uploaded!";
        }
      }
    }
    return params.filesArr.map((_, i) => `${MOCK_CLOUDINARY_URL}${params.folder}/file-${i}.jpg`);
  }
);

/**
 * Mock for deleteFilesCloudinary function
 */
export const mockDeleteFilesCloudinary = vi.fn().mockImplementation(
  async (imageUrl: string | undefined) => {
    if (!imageUrl) return true;
    return true;
  }
);

/**
 * Mock for deleteFolderCloudinary function
 */
export const mockDeleteFolderCloudinary = vi.fn().mockImplementation(
  async (_folderPath: string) => {
    return true;
  }
);

/**
 * Mock for generateQrCode function
 */
export const mockGenerateQrCode = vi.fn().mockImplementation(
  async (businessId: string, salesPointId: string) => {
    return `${MOCK_CLOUDINARY_URL}/business/${businessId}/salesLocationQrCodes/${salesPointId}.png`;
  }
);

/**
 * Reset all Cloudinary mocks
 */
export const resetCloudinaryMocks = () => {
  mockUploadFilesCloudinary.mockClear();
  mockDeleteFilesCloudinary.mockClear();
  mockDeleteFolderCloudinary.mockClear();
  mockGenerateQrCode.mockClear();
};

/**
 * Usage Instructions:
 * 
 * To mock Cloudinary functions in your test file, add vi.mock calls at the top level:
 * 
 * @example
 * ```typescript
 * import { vi, describe, it, expect, beforeEach } from "vitest";
 * import {
 *   mockUploadFilesCloudinary,
 *   mockDeleteFilesCloudinary,
 *   resetCloudinaryMocks,
 * } from "../mocks/cloudinary.js";
 * 
 * // Mock at top level (these get hoisted)
 * vi.mock("../../src/cloudinary/uploadFilesCloudinary.js", () => ({
 *   uploadFilesCloudinary: mockUploadFilesCloudinary,
 * }));
 * 
 * vi.mock("../../src/cloudinary/deleteFilesCloudinary.js", () => ({
 *   deleteFilesCloudinary: mockDeleteFilesCloudinary,
 * }));
 * 
 * describe("Your tests", () => {
 *   beforeEach(() => {
 *     resetCloudinaryMocks();
 *   });
 *   // ... your tests
 * });
 * ```
 */
