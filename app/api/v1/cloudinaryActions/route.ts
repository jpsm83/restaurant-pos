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
    const imageFile = data.get("imageFile"); // retrieve the image file
    const files = data.getAll("files"); // Retrieve all files

    // Validate input
    if (
      !mainModelName ||
      (!mainModelId &&
        (!(files instanceof File) || !(imageFile instanceof File)))
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Model name, ID, and a valid image file are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // only file or imageFile can be uploaded at a time
    if (files.length > 0 && imageFile) {
      return new NextResponse(
        JSON.stringify({
          message: "Only one file or image can be uploaded at a time!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      files.length > 0 &&
      subModelName !== "Employee" &&
      !files.every(
        (file) => file instanceof File && file.type.startsWith("image/")
      )
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Only one file or image can be uploaded at a time!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (imageFile instanceof File && !imageFile.type.startsWith("image/")) {
      return new NextResponse(
        JSON.stringify({
          message: "Invalid image file type!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let folder = `restaurant-pos/${mainModelName.toLowerCase()}/${mainModelId.toLowerCase()}`;
    if (subModelName && subModelId) {
      folder += `/${subModelName.toLowerCase()}/${subModelId.toLowerCase()}`;
    }

    const uploadPreset = "restaurant-pos"; // Use your Cloudinary preset

    const uploadResultsFiles: string[] = [];

    if (imageFile instanceof File) {
      // Handle single image upload
      const fileBuffer = await imageFile.arrayBuffer();
      const mime = imageFile.type;
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

    if (Array.isArray(files) && files.every((file) => file instanceof File)) {
      // Handle multiple image uploads
      for (const file of files) {
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

    const updateModelResponse = await updateDbModels(
      subModelName ? subModelName : mainModelName,
      subModelId ? subModelId : mainModelId,
      uploadResultsFiles
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
        message: uploadResultsFiles,
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

// export async function DELETE(req: Request) {
//   try {
//     // example of a cloudinary image url
//     // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesInstanceQrCodes/66c9d6afc45a1547f9ab893b.png"
//     const {
//       imageUrl,
//       businessId,
//       businessGoodId,
//       employeeId,
//       purchaseId,
//       supplierGoodId,
//       supplierId,
//       userId,
//     } = await req.json();

//     if (!imageUrl) {
//       return new NextResponse(
//         JSON.stringify({
//           message: "Image url is required!",
//         }),
//         { status: 400, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     const documentModelResult = await documentModelExists(
//       businessId,
//       businessGoodId,
//       employeeId,
//       purchaseId,
//       supplierGoodId,
//       supplierId,
//       userId
//     );

//     if (typeof documentModelResult === "string") {
//       return new NextResponse(
//         JSON.stringify({ message: documentModelResult }),
//         { status: 400, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     // Delete the image from Cloudinary
//     const deleteResponse = await deleteCloudinaryImage(imageUrl);

//     if (deleteResponse) {
//       return new NextResponse(
//         JSON.stringify({
//           message: "Error occurred on deleteCloudinaryImage: " + deleteResponse,
//         }),
//         { status: 400, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     const updateModelResponse = await updateDbModels(
//       documentModelResult.name as string,
//       documentModelResult.id
//     );

//     if (updateModelResponse) {
//       return new NextResponse(
//         JSON.stringify({
//           message:
//             "Error occurred on updateDocumentModels: " + updateModelResponse,
//         }),
//         { status: 400, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     return new NextResponse(
//       JSON.stringify({
//         message: "Image deleted successfully.",
//       }),
//       {
//         status: 200,
//         headers: { "Content-Type": "application/json" },
//       }
//     );
//   } catch (error) {
//     return handleApiError(
//       "Error occurred while deleting the image(s).",
//       error as string
//     );
//   }
// }
