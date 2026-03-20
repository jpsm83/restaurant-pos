import { v2 as cloudinary } from "cloudinary";
import configureCloudinary from "./cloudinaryConfig.ts";

const deleteFilesCloudinary = async (
  imageUrl: string | undefined
): Promise<boolean | string> => {
  // Configure cloudinary at runtime (after env vars are loaded)
  configureCloudinary();

  try {
    if (imageUrl) {
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

export default deleteFilesCloudinary;