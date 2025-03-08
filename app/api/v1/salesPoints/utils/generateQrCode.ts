import { Types } from "mongoose";
import QRCode from "qrcode";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary (you should have these values in your environment variables)
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const generateQrCode = async (businessId: Types.ObjectId) => {
  try {
    // generate randomUniqueId
    const randomUniqueId = new Types.ObjectId().toString();

    // this QR will redirect to a page where employee can order and pay - to be developed
    //    scan QR
    //    select language
    //    createSalesLocation function will be called so employee will fill the necessary inputs
    //      salesLocation - auto generated
    //      guests - employee input
    //      openedBy - auto generated
    //      responsibleBy - auto generated
    //      business - auto generated
    //      clientName - employee input
    //      dailyReferenceNumber - auto generated
    // *** once a table is created, no other employee will be able to scan the QR code and create a table till this table is closed ***
    //    employee will be redirected to an order menu page - to be developed
    //    employee will select items and quantity
    //    employee will pay for the order and get a confirmation message with order number to be compare by the waiter
    //    them order will be place to the kitchen/bar

    // Generate QR code as a data URL
    // this is the api url where the qrcode will redirect
    const qrCodeDataUrl = await QRCode.toDataURL(
      `http://localhost:3000/api/salesInstances/selfOrderingLocationId/${randomUniqueId}`
    );

    // Prepare the data for Cloudinary upload
    const bytes = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");
    const fileUri = `data:image/png;base64,${bytes.toString("base64")}`;

    // Upload the QR code image to Cloudinary
    const uploadPreset = "restaurant-pos"; // Use your Cloudinary preset

    const response = await cloudinary.uploader.upload(fileUri, {
      invalidate: true,
      upload_preset: uploadPreset,
      public_id: randomUniqueId, // use the ID as the public ID
      // businessId is used as a folder name
      folder: `restaurant-pos/${businessId}/salesLocationQrCodes`, // specify a folder in Cloudinary
    });

    // Return the Cloudinary URL
    return response.secure_url;
    // example of a return
    // "https://res.cloudinary.com/jpsm83/image/upload/v1724503727/restaurant-pos/6673fed98c45d0a0ca5f34c1/salesLocationQrCodes/66c9d6afc45a1547f9ab893b.png"
  } catch (error) {
    return "Failed to generate QR code: " + error;
  }
};
