import { v2 as cloudinary } from "cloudinary";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
  secure: true,
});

export default async function deleteFolderCloudinary(folderPath: string): Promise<boolean | string> {
  try {
    // **Step 1: Delete all files in the folder and subfolders**
    await cloudinary.api.delete_resources_by_prefix(folderPath);

    // **Step 2: Delete the empty folder (and all subfolders)**
    await cloudinary.api.delete_folder(folderPath);

    return true;
  } catch (error: unknown) {
    console.error("Cloudinary cleanup failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
