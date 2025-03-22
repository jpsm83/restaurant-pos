import { v2 as cloudinary } from "cloudinary";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

interface IAddSingleFile {
  mainModelName: string;
  mainModelId: string;
  subModelName?: string;
  subModelId?: string;
  singleData?: FormDataEntryValue | null;
  multipleData?: FormDataEntryValue[] | null;
}

export async function addSingleFile({
  mainModelName,
  mainModelId,
  subModelName,
  subModelId,
  singleData,
  multipleData,
}: IAddSingleFile): Promise<string> {
  try {

    if (!mainModelName || (!mainModelId) || (!singleData && !multipleData)) {
  return "Model name, id, and at least one type of data (single or multiple) are required!";
}

    let folder = `restaurant-pos/${mainModelName}/${mainModelId}`;
    if (subModelName && subModelId) {
      folder += `/${subModelName}/${subModelId}`;
    }

    const uploadPreset = "restaurant-pos"; // Use your Cloudinary preset

    const uploadResultsFiles: string[] = [];

    if (singleData instanceof File) {
      // Handle single image upload
      const fileBuffer = await singleData.arrayBuffer();
      const mime = singleData.type;
      const encoding = "base64";
      const base64Data = Buffer.from(fileBuffer).toString("base64");
      const fileUri = `data:${mime};${encoding},${base64Data}`;

      const response = await cloudinary.uploader.upload(fileUri, {
        invalidate: true,
        upload_preset: uploadPreset,
        folder: folder,
      });

      uploadResultsFiles.push(response.secure_url);
    }

    if (
      Array.isArray(multipleData) &&
      multipleData.every((file) => file instanceof File)
    ) {
      // Handle multiple image uploads
      for (const file of multipleData) {
        const fileBuffer = await file.arrayBuffer();
        const mime = file.type;
        const encoding = "base64";
        const base64Data = Buffer.from(fileBuffer).toString("base64");
        const fileUri = `data:${mime};${encoding},${base64Data}`;

        const response = await cloudinary.uploader.upload(fileUri, {
          invalidate: true,
          upload_preset: uploadPreset,
          folder: folder,
        });

        uploadResultsFiles.push(response.secure_url);
      }
    }

    return uploadResultsFiles.join(", ");
  } catch (error) {
    return `An error occurred while uploading files: ${error}`;
  }
}
