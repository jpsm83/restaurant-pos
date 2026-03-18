import { v2 as cloudinary } from "cloudinary";

export async function deleteFolderCloudinary(folderPath: string): Promise<boolean | string> {
  // Configure cloudinary at runtime (after env vars are loaded)
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  try {
    const uploadPreset = "restaurant-pos";

    await cloudinary.api.delete_resources_by_prefix(uploadPreset + folderPath);

    await cloudinary.api.delete_folder(uploadPreset + folderPath);

    return true;
  } catch (error: unknown) {
    console.error("Cloudinary cleanup failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
