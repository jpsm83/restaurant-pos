import { v2 as cloudinary } from "cloudinary";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default async function uploadSingleImage({ folder, imageFile }) {
  const uploadPreset = "restaurant-pos";

  if (imageFile instanceof File) {
    if (!imageFile.type.startsWith("image/")) {
      return "Only images can be uploaded!";
    }

    try {
      // Convert File to buffer for Cloudinary
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Create a data URI
      const dataUri = `data:${imageFile.type};base64,${buffer.toString(
        "base64"
      )}`;

      const response = await cloudinary.uploader.upload(dataUri, {
        invalidate: true,
        upload_preset: uploadPreset,
        folder: `${uploadPreset}${folder}`,
        resource_type: "auto",
      });

      return response.secure_url;
    } catch (error) {
      return `Error uploading image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
    }
  }
}
