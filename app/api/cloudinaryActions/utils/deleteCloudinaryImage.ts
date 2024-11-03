import { v2 as cloudinary } from "cloudinary";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const deleteCloudinaryImage = async (imageUrl: string) => {
  try {
    // example of a cloudinary image url
    // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesInstanceQrCodes/66c9d6afc45a1547f9ab893b.png"
    if (!imageUrl) {
      return "Image url is required!";
    }

    // Extract cloudinaryPublicId using regex
    // example of a publicId
    // "restaurant-pos/6673fed98c45d0a0ca5f34c1/salesInstanceQrCodes/66c9d6afc45a1547f9ab893b"
    let cloudinaryPublicId = imageUrl.match(/restaurant-pos\/[^.]+/);

    const deletionResponse = await cloudinary.uploader.destroy(
      cloudinaryPublicId?.[0] ?? "",
      {
        resource_type: "image",
      }
    );

    if (deletionResponse.result !== "ok") {
      return "DeleteCloudinaryImage failed!";
    }
    return true;
  } catch (error) {
    return error;
  }
};

export default deleteCloudinaryImage;
