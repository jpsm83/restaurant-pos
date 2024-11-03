import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported interfaces
import { ICustomer } from "@/app/lib/interface/ICustomer";

// imported models
import Customer from "@/app/lib/models/customer";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { personalDetailsValidation } from "@/app/lib/utils/personalDetailsValidation";

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

    const customer = await Customer.findById(customerId)
      .select("-password")
      .lean();

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
    return handleApiError("Get customer by its id failed!", error);
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
  try {
    const customerId = context.params.customerId;
    const {
      customerName,
      email,
      password,
      idType,
      idNumber,
      personalDetails,
      address,
    } = (await req.json()) as ICustomer;

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

    // prepare update object
    const updateCustomerObj: Partial<ICustomer> = {};

    // add address fields
    if (address) {
      const validAddress = addressValidation(address);
      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      updateCustomerObj.address = address;
    }

        // check personalDetails validation
        if (personalDetails) {
          const checkPersonalDetailsValidation =
            personalDetailsValidation(personalDetails);
          if (checkPersonalDetailsValidation !== true) {
            return new NextResponse(
              JSON.stringify({ message: checkPersonalDetailsValidation }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          updateCustomerObj.personalDetails = personalDetails;
        }
    
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

    // check for duplicates customerName, email, taxNumber and idNumber with same business ID
    const duplicateCustomer = await Customer.exists({
      _id: { $ne: customerId },
      businessId: customer.businessId,
      $or: [{ customerName }, { email }, { idNumber }],
    });

    if (duplicateCustomer) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Customer with customerName, email or idNumber already exists!",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Hash password asynchronously only if it is provided
    if (password) {
      updateCustomerObj.password = await hash(password, 10);
    }

    // Populate the update object with other provided fields
    if (customerName) updateCustomerObj.customerName = customerName;
    if (email) updateCustomerObj.email = email;
    if (idType) updateCustomerObj.idType = idType;
    if (idNumber) updateCustomerObj.idNumber = idNumber;
    if (personalDetails) updateCustomerObj.personalDetails = personalDetails;

    // update the customer
    const updatedCustomer = await Customer.updateOne(
      { _id: customerId },
      { $set: updateCustomerObj }
    );

    // Check if the purchase was found and updated
    if (updatedCustomer.modifiedCount === 0) {
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
        message: `Customer ${updateCustomerObj.customerName} updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update customer failed!", error);
  }
};

// delete an customer shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an customer should be deleted is if the business itself is deleted
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
    return handleApiError("Delete customer failed!", error);
  }
};
