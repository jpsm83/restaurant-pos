import { v2 as cloudinary } from "cloudinary";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default async function deleteFilesCloudinary(
  imageUrl: string | undefined
): Promise<boolean | string> {
  try {
    // example of a cloudinary image url
    // "https://res.cloudinary.com/jpsm83/image/upload/v1742636639/restaurant-pos/business/66e169a709901431386c97cb/suppliers/67de865e17261dbaf2ec3ee3/dexnymwfq0bivflousfl.png"
    if (imageUrl) {
      // Extract cloudinaryPublicId using regex
      // example of a publicId
      // "restaurant-pos/business/66e169a709901431386c97cb/suppliers/67de865e17261dbaf2ec3ee3/dexnymwfq0bivflousfl.png"
      const cloudinaryPublicId = imageUrl.match(/restaurant-pos\/[^.]+/);

      const deletionResponse = await cloudinary.uploader.destroy(
        cloudinaryPublicId?.[0] ?? "",
        {
          resource_type: "image",
        }
      );

      if (deletionResponse.result !== "ok") {
        return "DeleteCloudinaryImage failed!";
      }
    }
    return true;
  } catch (error) {
    return `Error trying to upload image: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
}
