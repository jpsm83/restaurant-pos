import { Types } from "mongoose";
import QRCode from "qrcode";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export const generateQrCode = async (
  businessId: Types.ObjectId | string,
  salesPointId: Types.ObjectId
) => {
  try {
    const salesPointIdStr = salesPointId.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(
      `${BASE_URL}/api/v1/salesInstances/selfOrderingLocation/${salesPointIdStr}`
    );

    const bytes = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");
    const fileUri = `data:image/png;base64,${bytes.toString("base64")}`;

    const uploadPreset = "restaurant-pos";

    const response = await cloudinary.uploader.upload(fileUri, {
      invalidate: true,
      upload_preset: uploadPreset,
      public_id: salesPointIdStr,
      folder: `restaurant-pos/business/${businessId}/salesLocationQrCodes`,
    });

    return response.secure_url;
  } catch (error) {
    return "Failed to generate QR code: " + error;
  }
};
