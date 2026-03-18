import { v2 as cloudinary } from "cloudinary";

export interface UploadInputFile {
  buffer: Buffer;
  mimeType: string;
}

export async function uploadFilesCloudinary(params: {
  folder: string;
  filesArr: UploadInputFile[];
  onlyImages?: boolean;
}): Promise<string | string[]> {
  // Configure cloudinary at runtime (after env vars are loaded)
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const uploadPreset = "restaurant-pos";

  if (params.onlyImages) {
    for (const f of params.filesArr) {
      if (!f.mimeType.startsWith("image/")) return "Only images can be uploaded!";
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
      })
    );
    return uploaded;
  } catch (error) {
    return `Error trying to upload images: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}

