import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import objDefaultValidation from "@/lib/utils/objDefaultValidation";

// imported interfaces
import { IPersonalDetails } from "@/lib/interface/IPersonalDetails";

// imported models
import User from "@/lib/db/models/user";
import { IUser } from "@/lib/interface/IUser";

const reqPersonalDetailsFields = [
  "username",
  "email",
  "password",
  "idType",
  "idNumber",
  "firstName",
  "lastName",
  "address",
];

const nonReqPersonalDetailsFields = [
  "imageUrl",
  "nationality",
  "gender",
  "birthDate",
  "phoneNumber",
];

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
// @route   GET /customers/:customerId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { customerId: Types.ObjectId } }
) => {
  try {
    const customerId = context.params.customerId;

    if (!isObjectIdValid([customerId])) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid user ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const user = await User.findById(customerId, {
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
// @route   PATCH /customers/:customerId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { customerId: Types.ObjectId } }
) => {
    const customerId = context.params.customerId;
    const {
      personalDetails,
    }: {
      personalDetails: IPersonalDetails;
    } = await req.json();

    // check required fields
    if (!personalDetails) {
      return new NextResponse(
        JSON.stringify({
          message: "PersonalDetails is required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate customerId
    if (!isObjectIdValid([customerId])) {
      return new NextResponse(
        JSON.stringify({ message: "User ID is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // validate personalDetails
    const personalDetailsValidationResult = objDefaultValidation(
      personalDetails,
      reqPersonalDetailsFields,
      nonReqPersonalDetailsFields
    );

    if (personalDetailsValidationResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: personalDetailsValidationResult }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // validate address
    const addressValidationResult = objDefaultValidation(
      personalDetails.address,
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
    const user = await User.findById(customerId);
    if (!user) {
      return new NextResponse(
        JSON.stringify({ message: "User not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // check for duplicates username, email, taxNumber and idNumber
    const duplicateCustomer = await User.exists({
      _id: { $ne: customerId },
      $or: [
        { "personalDetails.username": personalDetails.username },
        { "personalDetails.email": personalDetails.email },
        { "personalDetails.idNumber": personalDetails.idNumber },
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

    const updateCustomerObj: Partial<IUser> = {};

    // Iterate through all keys in personalDetails
    Object.keys(personalDetails).forEach((key) => {
      // Check if the key exists in user.personalDetails and if the value has changed
      if (personalDetails[key] !== user.personalDetails[key] && key !== "address") {
        updateCustomerObj[`personalDetails.${key}`] = personalDetails[key];
      }
    
      // Handle nested "address" object
      if (key === "address" && personalDetails.address) {
        Object.keys(personalDetails.address).forEach((addressKey) => {
          // Check if the address field has changed or is new
          if (personalDetails.address[addressKey] !== user.personalDetails.address[addressKey]) {
            updateCustomerObj[`personalDetails.address.${addressKey}`] = personalDetails.address[addressKey];
          }
        });
      }
    });
    
    // If password is updated, hash it and add to the update object
    if (personalDetails.password) {
      updateCustomerObj["personalDetails.password"] = await hash(personalDetails.password, 10);
    }
    
    // Update user with only changed fields
    const updatedCustomer = await User.findOneAndUpdate(
      { _id: customerId },
      { $set: updateCustomerObj },
      { new: true } // Returns the updated document
    );

    // Check if the purchase was found and updated
    if (!updatedCustomer) {
      return new NextResponse(
        JSON.stringify({ message: "User not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
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
// @route   DELETE /customers/:customerId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { customerId: Types.ObjectId } }
) => {
  try {
    const customerId = context.params.customerId;

    // check if the customerId is a valid ObjectId
    if (!isObjectIdValid([customerId])) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid user ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Delete the user
    const result = await User.deleteOne({ _id: customerId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "User not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `User id ${customerId} deleted successfully`,
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