import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function deleteFilesCloudinary(
  imageUrl: string | undefined
): Promise<boolean | string> {
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
