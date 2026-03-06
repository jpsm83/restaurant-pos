/**
 * deleteFilesCloudinary — Delete a single Cloudinary image by its URL
 *
 * Derives the Cloudinary public_id from a stored secure URL and calls
 * destroy so the asset is removed from Cloudinary. Used when replacing
 * or removing a single image (e.g. profile picture, menu item). Necessary
 * to keep Cloudinary in sync and avoid orphaned files when DB records change.
 */

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Deletes the image in Cloudinary that corresponds to imageUrl. If imageUrl
 * is undefined, returns true without calling the API. Public ID is parsed
 * from the URL path (restaurant-pos/... up to but not including extension).
 */
export default async function deleteFilesCloudinary(
  imageUrl: string | undefined
): Promise<boolean | string> {
  try {
    if (imageUrl) {
      /** URL path segment after /upload/... is the public_id (no file extension in ID). */
      const cloudinaryPublicId = imageUrl.match(/restaurant-pos\/[^.]+/);

      const deletionResponse = await cloudinary.uploader.destroy(
        cloudinaryPublicId?.[0] ?? "",
        {
          resource_type: "image",
        }
      );

      if (deletionResponse.result !== "ok") {
        return "DeleteCloudinaryImage failed!";
      }
    }
    return true;
  } catch (error) {
    return `Error trying to upload image: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}
