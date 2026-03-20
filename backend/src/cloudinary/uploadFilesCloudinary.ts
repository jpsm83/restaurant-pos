import { v2 as cloudinary } from "cloudinary";
import configureCloudinary from "./cloudinaryConfig.ts";
import type { UploadInputFile } from "../../../lib/interface/ICloudinary.ts";

const uploadFilesCloudinary = async (params: {
  folder: string;
  filesArr: UploadInputFile[];
  onlyImages?: boolean;
}): Promise<string | string[]> => {
  // Configure cloudinary at runtime (after env vars are loaded)
  configureCloudinary();

  const uploadPreset = "restaurant-pos";

  if (params.onlyImages) {
    for (const f of params.filesArr) {
      if (!f.mimeType.startsWith("image/"))
        return "Only images can be uploaded!";
    }
  }

  try {
    const uploaded = await Promise.all(
      params.filesArr.map(async (f) => {
        const dataUri = `data:${f.mimeType};base64,${f.buffer.toString("base64")}`;
        const res = await cloudinary.uploader.upload(dataUri, {
          invalidate: true,
          upload_preset: uploadPreset,
          folder: `${uploadPreset}${params.folder}`,
          resource_type: "auto",
        });
        return res.secure_url;
      }),
    );
    return uploaded;
  } catch (error) {
    return `Error trying to upload images: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
};

export default uploadFilesCloudinary;
