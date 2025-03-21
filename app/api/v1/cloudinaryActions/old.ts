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
    const imageFile = data.get("imageFile"); // retrieve the image file
    const files = data.getAll("files"); // Retrieve all files

    // if no userId, it means the request is from the business
    // ONE OF THOSE ARE REQUIRED
    const businessId = data.get("businessId") || null;
    const userId = data.get("userId") || null;

    // those are ids required for individaul models for the image
    const businessGoodId = data.get("businessGoodId") || null;
    const employeeId = data.get("employeeId") || null;
    const purchaseId = data.get("purchaseId") || null;
    const supplierGoodId = data.get("supplierGoodId") || null;
    const supplierId = data.get("supplierId") || null;

    // documentModelResult returns the following object or error message
    // const documentModel = {
    //   restaurantSubfolder: "",
    //   name: "Business",
    //   id: businessId,
    // };
    const documentModelResult = await documentModelExists(
      businessId,
      businessGoodId,
      employeeId,
      purchaseId,
      supplierGoodId,
      supplierId
      // userId
    );

    if (businessId && userId) {
      return new NextResponse(
        JSON.stringify({
          message: "Both businessId and userId are not allowed!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const multipleFilesDocuments = ["Employee"];
    const singleImageDocuments = ["Business", "Purchase", "Supplier", "User"];
    const multipleImagesDocuments = ["BusinessGood", "SupplierGood"];

    // if documentModelResult is a string, it means an error occurred
    if (businessId) {
      if (typeof documentModelResult === "string") {
        return new NextResponse(
          JSON.stringify({ message: documentModelResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // if files means multiple files are uploaded
      if (files) {
        // if model name includes in multipleImagesDocuments and files are not imgages
        if (
          multipleImagesDocuments.includes(
            documentModelResult.name as string
          ) &&
          !files.every(
            (file) => file instanceof File && file.type.startsWith("image/")
          )
        ) {
          return new NextResponse(
            JSON.stringify({ message: "Files must be images." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // supose to use "files" for model "Employee"
      if (
        multipleFilesDocuments.includes(documentModelResult.name as string) &&
        imageFile
      ) {
        return new NextResponse(
          JSON.stringify({
            message:
              "'Files' supose to be used insted of 'imageFile' to upload to 'Employee'",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // supose to use "imageFile" for models "Business", "Purchase", "Supplier"
      if (
        singleImageDocuments.includes(documentModelResult.name as string) &&
        files.length
      ) {
        return new NextResponse(
          JSON.stringify({ message: "Only single images is required!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // supose to use "imageFile" for model "User"
    if (userId && (!imageFile || files.length > 0)) {
      return new NextResponse(
        JSON.stringify({ message: "One image is required!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const folder = userId
      ? `restaurant-pos/users/${userId}`
      : typeof documentModelResult !== "string" &&
        documentModelResult.restaurantSubfolder &&
        documentModelResult.restaurantSubfolder.length > 0
      ? `restaurant-pos/business/${businessId}/${documentModelResult.restaurantSubfolder}/${documentModelResult.id}`
      : `restaurant-pos/business/${businessId}`;

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
    
    
    

    




    // const updateModelResponse = await updateDbModels(
    //   documentModelResult.name as string,
    //   documentModelResult.id,
    //   uploadResultsFiles // Join array into a single string
    // );

    // if (updateModelResponse) {
    //   return new NextResponse(
    //     JSON.stringify({
    //       message:
    //         "Error occurred on updateDocumentModels: " + updateModelResponse,
    //     }),
    //     { status: 400, headers: { "Content-Type": "application/json" } }
    //   );
    // }

    return new NextResponse(
      JSON.stringify({
        message: "Files uploaded and references saved successfully.",
        urls: uploadResultsFiles,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return new NextResponse(
      JSON.stringify({
        message: `An error occurred while uploading files. ${errorMessage}`,
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
      employeeId,
      purchaseId,
      supplierGoodId,
      supplierId,
      userId,
    } = await req.json();

    if (!imageUrl) {
      return new NextResponse(
        JSON.stringify({
          message: "Image url is required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const documentModelResult = await documentModelExists(
      businessId,
      businessGoodId,
      employeeId,
      purchaseId,
      supplierGoodId,
      supplierId,
      userId
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

    const updateModelResponse = await updateDbModels(
      documentModelResult.name as string,
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
    return handleApiError(
      "Error occurred while deleting the image(s).",
      error as string
    );
  }
}
