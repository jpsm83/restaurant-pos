/**
 * moveFilesBetweenFolders — Move all Cloudinary assets from one folder to another
 *
 * Lists resources under the source folder (with project prefix), then renames
 * each so it lives under the target folder. Useful for reorganizing assets
 * (e.g. moving a business folder after rename). Not currently used in the
 * project; kept for reference and potential future use.
 */

import { v2 as cloudinary } from "cloudinary";

/**
 * Moves all files from oldFolder to newFolder under the restaurant-pos prefix.
 * Returns array of new secure URLs or an error string. Max 500 resources per call.
 */
export async function moveFilesBetweenFolders({
  oldFolder,
  newFolder,
}: {
  oldFolder: string;
  newFolder: string;
}): Promise<string | string[]> {
  // Configure cloudinary at runtime (after env vars are loaded)
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  try {
    const uploadPreset = "restaurant-pos";

    /** Cloudinary API expects full path including preset/prefix. */
    const fullOldFolder = `${uploadPreset}/${oldFolder}`;
    const fullNewFolder = `${uploadPreset}/${newFolder}`;

    const { resources } = await cloudinary.api.resources({
      type: "upload",
      prefix: fullOldFolder,
      max_results: 500,
    });

    if (!resources.length) {
      return `No files found in the folder: ${oldFolder}`;
    }

    /** rename() effectively moves the asset by changing its public_id path. */
    const movePromises = resources.map(async (file: { public_id: string }) => {
      const newPublicId = file.public_id.replace(fullOldFolder, fullNewFolder);
      const response = await cloudinary.uploader.rename(
        file.public_id,
        newPublicId
      );
      return response.secure_url;
    });

    const movedFiles = await Promise.all(movePromises);

    return movedFiles;
  } catch (error) {
    return `Error moving files: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}