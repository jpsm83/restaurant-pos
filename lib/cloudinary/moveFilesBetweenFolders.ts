// ===============================================================
// THIS CODE BEEN CREATED BUT NEVER USED IN THE PROJECT
// ===============================================================
// keep for reference and maibe future use
// ===============================================================

import { v2 as cloudinary } from "cloudinary";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function moveFilesBetweenFolders({
  oldFolder,
  newFolder,
}: {
  oldFolder: string;
  newFolder: string;
}): Promise<string | string[]> {
  try {
    // Define upload preset (Project identifier)
    const uploadPreset = "restaurant-pos";

    // Cloudinary expects full folder path, including project prefix
    const fullOldFolder = `${uploadPreset}/${oldFolder}`;
    const fullNewFolder = `${uploadPreset}/${newFolder}`;

    // List all files in the old folder
    const { resources } = await cloudinary.api.resources({
      type: "upload",
      prefix: fullOldFolder, // ✅ Now includes project prefix
      max_results: 500,
    });

    if (!resources.length) {
      return `No files found in the folder: ${oldFolder}`;
    }

    // Move each file to the new folder
    const movePromises = resources.map(async (file: { public_id: string }) => {
      const newPublicId = file.public_id.replace(fullOldFolder, fullNewFolder);
      const response = await cloudinary.uploader.rename(
        file.public_id,
        newPublicId
      );
      return response.secure_url;
    });

    // Wait for all files to move
    const movedFiles = await Promise.all(movePromises);

    return movedFiles;
  } catch (error) {
    return `Error moving files: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}
