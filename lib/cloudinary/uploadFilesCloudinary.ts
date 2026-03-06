/**
 * uploadFilesCloudinary — Upload files to Cloudinary and return URLs
 *
 * Accepts File[] and uploads them under a project folder, optionally
 * restricting to images. Returns an array of secure URLs or an error
 * string. Centralizes Cloudinary config, preset, and folder naming so
 * uploads are consistent and cache/CDN-friendly. Necessary for menu
 * images, avatars, and any user-uploaded assets.
 */

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads one or more files to Cloudinary. Uses upload_preset "restaurant-pos"
 * and places files under restaurant-pos{folder}. When onlyImages is true,
 * rejects non-image types and returns an error string.
 */
export default async function uploadFilesCloudinary({
  folder,
  filesArr,
  onlyImages,
}: {
  folder: string;
  filesArr: File[];
  onlyImages?: boolean;
}): Promise<string | string[]> {
  const uploadPreset = "restaurant-pos";

  if (onlyImages) {
    for (const file of filesArr) {
      if (!(file instanceof File) || !file.type.startsWith("image/")) {
        return "Only images can be uploaded!";
      }
    }
  }

  try {
    const uploadPromises = filesArr.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      /** Data URI required by Cloudinary uploader.upload from server. */
      const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

      const response = await cloudinary.uploader.upload(dataUri, {
        invalidate: true,
        upload_preset: uploadPreset,
        folder: `${uploadPreset}${folder}`,
        resource_type: "auto",
      });

      return response.secure_url;
    });

    const uploadedUrls = await Promise.all(uploadPromises);

    return uploadedUrls;
  } catch (error) {
    return `Error trying to upload images: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}
