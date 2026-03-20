/**
 * deleteFolderCloudinary — Remove a Cloudinary folder and all its assets
 *
 * Deletes every resource under the given path (by prefix), then removes the
 * folder itself. Used when cleaning up after deleted entities (e.g. business
 * or category) so Cloudinary storage and CDN stay in sync with app data.
 * Necessary to avoid orphaned files and unnecessary storage cost.
 */

import { v2 as cloudinary } from "cloudinary";
import configureCloudinary from "./cloudinaryConfig.ts";

/**
 * Deletes all resources under restaurant-pos{folderPath}, then the folder.
 * Returns true on success, false on error (and logs to console).
 */
const deleteFolderCloudinary = async (folderPath: string): Promise<boolean | string> => {
  try {
    // Configure cloudinary at runtime (after env vars are loaded)
    configureCloudinary();

    const uploadPreset = "restaurant-pos";

    /** Must delete assets first; delete_folder only removes empty folder structure. */
    await cloudinary.api.delete_resources_by_prefix(uploadPreset + folderPath);

    await cloudinary.api.delete_folder(uploadPreset + folderPath);

    return true;
  } catch (error: unknown) {
    console.error("Cloudinary cleanup failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

export default deleteFolderCloudinary;