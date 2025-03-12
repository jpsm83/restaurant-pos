import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import objDefaultValidation from "@/app/lib/utils/objDefaultValidation";

// imported interfaces
import { IPersonalDetails } from "@/app/lib/interface/IPersonalDetails";

// imported models
import Customer from "@/app/lib/models/customer";
import { ICustomer } from "@/app/lib/interface/ICustomer";

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
  "deviceToken",
  "notifications",
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

// @desc    Get customer by ID
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
        JSON.stringify({ message: "Invalid customer ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const customer = await Customer.findById(customerId, {
      "personalDetails.password": 0,
    }).lean();

    return !customer
      ? new NextResponse(JSON.stringify({ message: "Customer not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(customer), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get customer by its id failed!", error as string);
  }
};

// customer DO NOT UPDATE notifications, only readFlag
// @desc    Update customer
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
        JSON.stringify({ message: "Customer ID is not valid!" }),
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
    
    // check if customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return new NextResponse(
        JSON.stringify({ message: "Customer not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // check for duplicates username, email, taxNumber and idNumber
    const duplicateCustomer = await Customer.exists({
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
          message: "Customer with username, email or idNumber already exists!",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const updateCustomerObj: Partial<ICustomer> = {};

    // Iterate through all keys in personalDetails
    Object.keys(personalDetails).forEach((key) => {
      // Check if the key exists in customer.personalDetails and if the value has changed
      if (personalDetails[key] !== customer.personalDetails[key] && key !== "address") {
        updateCustomerObj[`personalDetails.${key}`] = personalDetails[key];
      }
    
      // Handle nested "address" object
      if (key === "address" && personalDetails.address) {
        Object.keys(personalDetails.address).forEach((addressKey) => {
          // Check if the address field has changed or is new
          if (personalDetails.address[addressKey] !== customer.personalDetails.address[addressKey]) {
            updateCustomerObj[`personalDetails.address.${addressKey}`] = personalDetails.address[addressKey];
          }
        });
      }
    });
    
    // If password is updated, hash it and add to the update object
    if (personalDetails.password) {
      updateCustomerObj["personalDetails.password"] = await hash(personalDetails.password, 10);
    }
    
    // Update customer with only changed fields
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: customerId },
      { $set: updateCustomerObj },
      { new: true } // Returns the updated document
    );

    // Check if the purchase was found and updated
    if (!updatedCustomer) {
      return new NextResponse(
        JSON.stringify({ message: "Customer not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Customer updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update customer failed!", error as string);
  }
};

// delete an customer shouldnt be allowed for data integrity, historical purposes and analytics
// If you delete a customer from the database and there are other documents that have a relationship with that customer, those related documents may still reference the deleted customer. This can lead to issues such as orphaned records, broken references, and potential errors when querying or processing those related documents.
// @desc    Delete customer
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
        JSON.stringify({ message: "Invalid customer ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Delete the customer
    const result = await Customer.deleteOne({ _id: customerId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Customer not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Customer id ${customerId} deleted successfully`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete customer failed!", error as string);
  }
};