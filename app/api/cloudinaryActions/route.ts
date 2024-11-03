import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import updateDbModels from "./utils/updateDbModels";
import deleteCloudinaryImage from "./utils/deleteCloudinaryImage";
import documentModelExists from "./utils/documentModelExists";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const imageFile = data.get("imageFile");
    const businessId = data.get("businessId");

    // those are ids required for individaul models for the image
    const businessGoodId = data.get("businessGoodId") || null; // subfolder = "businessGoods"
    const supplierGoodId = data.get("supplierGoodId") || null; // subfolder = "supplierGoods"
    const supplierId = data.get("supplierId") || null; // subfolder = "suppliers"
    const employeeId = data.get("employeeId") || null; // subfolder = "employees"
    const purchaseId = data.get("purchaseId") || null; // subfolder = "purchases"

    let documentModelResult: any = await documentModelExists(
      businessId,
      businessGoodId,
      supplierGoodId,
      supplierId,
      employeeId,
      purchaseId
    );

    if (typeof documentModelResult === "string") {
      return new NextResponse(
        JSON.stringify({ message: documentModelResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!imageFile || !businessId || !(imageFile instanceof File)) {
      return new NextResponse(
        JSON.stringify({ message: "Image file and business ID are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare the data for Cloudinary upload
    const bytes = await imageFile.arrayBuffer();
    const mime = imageFile.type;
    const encoding = "base64";
    const base64Data = Buffer.from(bytes).toString("base64");
    const fileUri = `data:${mime};${encoding},${base64Data}`;

    // to which project in Cloudinary
    const uploadPreset = "restaurant-pos"; // Use your Cloudinary preset

    const folder =
      documentModelResult.restaurantSubfolder.length > 0
        ? `restaurant-pos/${businessId}/${documentModelResult.restaurantSubfolder}`
        : `restaurant-pos/${businessId}`;

    const response = await cloudinary.uploader.upload(fileUri, {
      invalidate: true,
      upload_preset: uploadPreset,
      // businessId is used as a folder name
      folder: folder, // Optional: specify a folder in Cloudinary
    });

    let updateModelResponse = await updateDbModels(
      documentModelResult.name,
      documentModelResult.id,
      response.secure_url
    );

    if (updateModelResponse) {
      const deleteResponse = await deleteCloudinaryImage(response.secure_url);

      if (deleteResponse) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Error occurred on deleteCloudinaryImage: " + deleteResponse,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      return new NextResponse(
        JSON.stringify({
          message:
            "Error occurred on updateDocumentModels: " + updateModelResponse,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Image upload and url reference saved" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        message: "An error occurred while uploading images." + error,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    // example of a cloudinary image url
    // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesInstanceQrCodes/66c9d6afc45a1547f9ab893b.png"
    const {
      imageUrl,
      businessId,
      businessGoodId,
      supplierGoodId,
      supplierId,
      employeeId,
      purchaseId,
    } = await req.json();

    if (!imageUrl) {
      return new NextResponse(
        JSON.stringify({
          message: "Image url is required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let documentModelResult: any = await documentModelExists(
      businessId,
      businessGoodId,
      supplierGoodId,
      supplierId,
      employeeId,
      purchaseId
    );

    if (typeof documentModelResult === "string") {
      return new NextResponse(
        JSON.stringify({ message: documentModelResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete the image from Cloudinary
    const deleteResponse = await deleteCloudinaryImage(imageUrl);

    if (deleteResponse) {
      return new NextResponse(
        JSON.stringify({
          message: "Error occurred on deleteCloudinaryImage: " + deleteResponse,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let updateModelResponse = await updateDbModels(
      documentModelResult.name,
      documentModelResult.id
    );

    if (updateModelResponse) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Error occurred on updateDocumentModels: " + updateModelResponse,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Image deleted successfully.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Error occurred while deleting the image(s).", error);
  }
}
