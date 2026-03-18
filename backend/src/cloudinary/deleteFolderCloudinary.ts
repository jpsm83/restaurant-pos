import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
  secure: true,
});

export async function deleteFolderCloudinary(folderPath: string): Promise<boolean | string> {
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
