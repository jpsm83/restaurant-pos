import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@shared/utils/objDefaultValidation";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";
import deleteFilesCloudinary from "@/lib/cloudinary/deleteFilesCloudinary";

// imported interfaces
import { IUser } from "@shared/interfaces/IUser";

// imported models
import User from "@/lib/db/models/user";
import deleteFolderCloudinary from "@/lib/cloudinary/deleteFolderCloudinary";
import { IEmployee } from "@shared/interfaces/IEmployee";
import Employee from "@/lib/db/models/employee";

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];

const nonReqAddressFields = ["region", "additionalDetails", "coordinates"];

// @desc    Get user by ID
// @route   GET /customers/:userId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    if (!isObjectIdValid([userId])) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    const user = await User.findById(userId, {
      "personalDetails.password": 0,
    }).lean();

    return !user
      ? new NextResponse(JSON.stringify({ message: "User not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(user), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get user by its id failed!", error as string);
  }
};

// user DO NOT UPDATE notifications, only readFlag
// @desc    Update user
// @route   PATCH /customers/:userId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  const { userId } = context.params;

  // validate userId
  if (!isObjectIdValid([userId])) {
    return new NextResponse(
      JSON.stringify({ message: "User ID is not valid!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Parse FORM DATA instead of JSON because we might have an image file
  const formData = await req.formData();

  // Extract fields from formData
  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string | undefined;
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
          "Username, email, idType, idNumber, address, firstName, lastName, nationality, gender, birthDate, phoneNumber are required!",
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

  try {
    // connect before first call to DB
    await connectDb();

    // check if user exists
    const user = await User.findById(userId);

    if (!user) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // check for duplicates username, email, taxNumber and idNumber
    const duplicateCustomer = await User.exists({
      _id: { $ne: userId },
      $or: [
        { "personalDetails.username": username },
        { "personalDetails.email": email },
        { "personalDetails.idNumber": idNumber },
      ],
    });

    if (duplicateCustomer) {
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

    // Prepare updated fields only if they exist (partial update)
    const updateUserObj: Partial<IUser> = {};

    if (username && username !== user.personalDetails.username) {
      updateUserObj["personalDetails.username"] = username;
    }
    if (email && email !== user.personalDetails.email) {
      updateUserObj["personalDetails.email"] = email;
    }
    if (idType && idType !== user.personalDetails.idType) {
      updateUserObj["personalDetails.idType"] = idType;
    }
    if (idNumber && idNumber !== user.personalDetails.idNumber) {
      updateUserObj["personalDetails.idNumber"] = idNumber;
    }
    if (firstName && firstName !== user.personalDetails.firstName) {
      updateUserObj["personalDetails.firstName"] = firstName;
    }
    if (lastName && lastName !== user.personalDetails.lastName) {
      updateUserObj["personalDetails.lastName"] = lastName;
    }
    if (nationality && nationality !== user.personalDetails.nationality) {
      updateUserObj["personalDetails.nationality"] = nationality;
    }
    if (gender && gender !== user.personalDetails.gender) {
      updateUserObj["personalDetails.gender"] = gender;
    }
    if (
      birthDate &&
      birthDate !== user.personalDetails.birthDate.toISOString()
    ) {
      updateUserObj["personalDetails.birthDate"] = birthDate;
    }
    if (phoneNumber && phoneNumber !== user.personalDetails.phoneNumber) {
      updateUserObj["personalDetails.phoneNumber"] = phoneNumber;
    }

    // Handle address updates
    if (address) {
      Object.keys(address).forEach((key) => {
        if (address[key] !== user.personalDetails.address[key]) {
          updateUserObj[`personalDetails.address.${key}`] = address[key];
        }
      });
    }

    // If password is updated, hash it and add to the update object
    if (password) {
      updateUserObj["personalDetails.password"] = await hash(
        updateUserObj.personalDetails!.password,
        10
      );
    }

    if (imageUrl && imageUrl instanceof File && imageUrl.size > 0) {
      const folder = `/users/${userId}`;

      // first upload new image
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

      // if new image been created, then delete the old one
      const deleteFilesCloudinaryResult: string | boolean =
        await deleteFilesCloudinary(user?.personalDetails.imageUrl || "");

      // check if deleteFilesCloudinary failed
      if (deleteFilesCloudinaryResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: deleteFilesCloudinaryResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      updateUserObj["personalDetails.imageUrl"] = cloudinaryUploadResponse[0];
    }

    // Update user with only changed fields
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateUserObj },
      { new: true, lean: true } // Returns the updated document
    );

    // Check if the purchase was found and updated
    if (!updatedUser) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new NextResponse(
      JSON.stringify({
        message: `User updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update user failed!", error as string);
  }
};

// delete an user shouldnt be allowed for data integrity, historical purposes and analytics
// If you delete a user from the database and there are other documents that have a relationship with that user, those related documents may still reference the deleted user. This can lead to issues such as orphaned records, broken references, and potential errors when querying or processing those related documents.
// @desc    Delete user
// @route   DELETE /customers/:userId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const { userId } = context.params;

    // check if the userId is a valid ObjectId
    if (!isObjectIdValid([userId])) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    // if user is employeed, then it cannot be deleted
    const employee = (await Employee.findOne({ userId: userId }).select("terminatedDate").lean()) as IEmployee | null;
      

    if (employee?.terminatedDate) {
      return new NextResponse(
        JSON.stringify({
          message: "User cannot be deleted because he/she is employeed!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the user
    // findOneAndDelete returns the deleted document
    const deletedUser = await User.findOneAndDelete({
      _id: userId,
    });

    if (!deletedUser) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // cloudinary folder path
    const folderPath = `/users/${userId}`;

    // Delete user folder in cloudinary
    const deleteFolderCloudinaryResult: string | boolean =
      await deleteFolderCloudinary(folderPath);

    if (deleteFolderCloudinaryResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: deleteFolderCloudinaryResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `User deleted successfully`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete user failed!", error as string);
  }
};
