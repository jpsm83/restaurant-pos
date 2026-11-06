import { v2 as cloudinary } from "cloudinary";
import configureCloudinary from "./cloudinaryConfig.ts";
import { ownedPublicIdFor } from "./cloudinaryAsset.ts";

const deleteFilesCloudinary = async (
  imageUrl: string | undefined
): Promise<boolean | string> => {
  // Configure cloudinary at runtime (after env vars are loaded)
  configureCloudinary();

  try {
    if (imageUrl) {
      const cloudinaryPublicId = ownedPublicIdFor(imageUrl);

      // If the existing URL isn't one of our Cloudinary assets, there's nothing to delete.
      if (!cloudinaryPublicId) {
        return true;
      }

      const deletionResponse = await cloudinary.uploader.destroy(
        cloudinaryPublicId,
        {
          resource_type: "image",
        }
      );

      // Cloudinary can return "not found" if asset was already removed.
      if (deletionResponse.result !== "ok" && deletionResponse.result !== "not found") {
        return "DeleteCloudinaryImage failed!";
      }
    }
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : (() => {
              try {
                return JSON.stringify(error);
              } catch {
                return String(error);
              }
            })();

    return `DeleteCloudinaryImage failed: ${message || "Unknown error"}`;
  }
}

export default deleteFilesCloudinary;