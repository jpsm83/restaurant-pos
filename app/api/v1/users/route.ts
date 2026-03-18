import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import mongoose from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import objDefaultValidation from "@shared/utils/objDefaultValidation";
import { handleApiError } from "@/lib/db/handleApiError";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";

// imported models
import User from "@/lib/db/models/user";

// imported interface
import { IUser } from "@shared/interfaces/IUser";

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];

const nonReqAddressFields = ["region", "additionalDetails", "coordinates"];

// @desc    Get all users
// @route   GET /users
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const users = await User.find(
      {},
      { "personalDetails.password": 0 }
    ).lean();

    return !users?.length
      ? new NextResponse(JSON.stringify({ message: "No users found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(users), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all users failed!", error as string);
  }
};

// @desc    Create new user
// @route   POST /user
// @access  Private
export const POST = async (req: Request) => {
  try {
    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract fields from formData
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const idType = formData.get("idType") as string;

    const idNumber = formData.get("idNumber") as string;
    const address = JSON.parse(formData.get("address") as string);
    const firstName = formData.get("firstName") as string; // Convert string to boolean
    const lastName = formData.get("lastName") as string;
    const nationality = formData.get("nationality") as string;
    const gender = formData.get("gender") as string;
    const birthDate = formData.get("birthDate") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const imageUrl = formData.get("imageUrl") as File | undefined;

    // check required fields
    if (
      !username ||
      !email ||
      !password ||
      !idType ||
      !idNumber ||
      !address ||
      !firstName ||
      !lastName ||
      !nationality ||
      !gender ||
      !birthDate ||
      !phoneNumber
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Username, email, password, idType, idNumber, address, firstName, lastName, nationality, gender, birthDate, phoneNumber are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate address
    const addressValidationResult = objDefaultValidation(
      address,
      reqAddressFields,
      nonReqAddressFields
    );

    if (addressValidationResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: addressValidationResult }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicates username, email, taxNumber and idNumber
    const duplicateUser = await User.exists({
      $or: [
        { "personalDetails.username": username },
        { "personalDetails.email": email },
        { "personalDetails.idNumber": idNumber },
      ],
    });

    if (duplicateUser) {
      return new NextResponse(
        JSON.stringify({
          message: "User with username, email or idNumber already exists!",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Hash password asynchronously
    const hashedPassword = await hash(password, 10);

    const userId = new mongoose.Types.ObjectId();

    const newUser: IUser = {
      _id: userId,
      personalDetails: {
        username,
        email,
        password: hashedPassword,
        idType,
        idNumber,
        address,
        firstName,
        lastName,
        nationality,
        gender,
        birthDate,
        phoneNumber,
      },
    };

    // upload image to cloudinary
    if (imageUrl && imageUrl instanceof File && imageUrl.size > 0) {
      const folder = `/users/${userId}`;

      const cloudinaryUploadResponse = await uploadFilesCloudinary({
        folder,
        filesArr: [imageUrl], // only one image
        onlyImages: true,
      });

      if (
        typeof cloudinaryUploadResponse === "string" ||
        cloudinaryUploadResponse.length === 0 ||
        !cloudinaryUploadResponse.every((str) => str.includes("https://"))
      ) {
        return new NextResponse(
          JSON.stringify({
            message: `Error uploading image: ${cloudinaryUploadResponse}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      newUser.personalDetails.imageUrl = cloudinaryUploadResponse[0];
    }

    await User.create(newUser);

    return new NextResponse(
      JSON.stringify({
        message: `New user created successfully`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create user failed!", error as string);
  }
};
