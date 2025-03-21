import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import updateDbModels from "./utils/updateDbModels";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: Request) {
  try {
    const data = await req.formData(); // Read request body as formData

    // Extract form fields
    // MODELS NAMES HAS TO BE EXACTLY THE SAME AS IN THE DATABASE, FIRST LETTER CAPITALIZED
    const mainModelName = data.get("mainModelName") as string;
    const mainModelId = data.get("mainModelId") as string;
    const subModelName = data.get("subModelName") as string | null;
    const subModelId = data.get("subModelId") as string | null;
    const imageFile = data.get("imageFile");

    // Validate input
    if (!mainModelName || !mainModelId || !(imageFile instanceof File)) {
      return new NextResponse(
        JSON.stringify({
          message: "Model name, ID, and a valid image file are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // imageFile must be only one of type image
    if (!imageFile.type.startsWith("image/")) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid image file type!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let folder = `restaurant-pos/${mainModelName.toLowerCase()}/${mainModelId.toLowerCase()}`;
    if (subModelName && subModelId) {
      folder += `/${subModelName.toLowerCase()}/${subModelId.toLowerCase()}`;
    }

    const uploadPreset = "restaurant-pos"; // Cloudinary preset

    // Convert file to base64 for Cloudinary upload
    const fileBuffer = await imageFile.arrayBuffer();
    const mime = imageFile.type;
    const base64Data = Buffer.from(fileBuffer).toString("base64");
    const fileUri = `data:${mime};base64,${base64Data}`;

    // Upload to Cloudinary
    const response = await cloudinary.uploader.upload(fileUri, {
      invalidate: true,
      upload_preset: uploadPreset,
      folder: folder,
    });

    const updateModelResponse = await updateDbModels(
      subModelName ? subModelName : mainModelName,
      subModelId ? subModelId : mainModelId,
      [response.secure_url] // Join array into a single string
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
        message: "Upload successful",
        url: response.secure_url,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        message: "Error uploading image",
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
