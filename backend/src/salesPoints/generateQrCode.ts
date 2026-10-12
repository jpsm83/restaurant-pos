import { Types } from "mongoose";
import QRCode from "qrcode";
import { v2 as cloudinary } from "cloudinary";
import configureCloudinary, {
  CLOUDINARY_ROOT_FOLDER,
  CLOUDINARY_UPLOAD_PRESET,
} from "../cloudinary/cloudinaryConfig.ts";

const generateQrCode = async (
  businessId: Types.ObjectId | string,
  salesPointId: Types.ObjectId,
): Promise<string | string> => {
  // Configure cloudinary at runtime (after env vars are loaded)
  configureCloudinary();

  const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

  try {
    const salesPointIdStr = salesPointId.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(
      `${BASE_URL}/api/v1/salesInstances/selfOrderingLocation/${salesPointIdStr}`,
    );

    const bytes = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");
    const fileUri = `data:image/png;base64,${bytes.toString("base64")}`;

    const response = await cloudinary.uploader.upload(fileUri, {
      invalidate: true,
      upload_preset: CLOUDINARY_UPLOAD_PRESET,
      public_id: salesPointIdStr,
      folder: `${CLOUDINARY_ROOT_FOLDER}/business/${businessId}/salesLocationQrCodes`,
    });

    return response.secure_url;
  } catch (error) {
    return "Failed to generate QR code: " + error;
  }
};

export default generateQrCode;
