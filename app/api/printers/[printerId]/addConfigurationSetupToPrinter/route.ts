import { Types } from "mongoose";
import { NextResponse } from "next/server";

//imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Printer from "@/app/lib/models/printer";

// imported interfaces
import { IConfigurationSetupToPrintOrders } from "@/app/lib/interface/IPrinter";

// this route will add individual configurationSetupToPrintOrders configuration to the printer with their properties and the employees that will apply to
// [
//     "mainCategory": "Food", this will dictate what the printer will print as main category
//     "subCategories": ["Ice Cream", "Cake"] this will dictate what the printer will print as sub category from the main category
//   {
//     "salesPointIds": ["60d5ecb8b3333356aef7e633", "60d5ecb8b3333356aef7e633"], those are the sales points id that this configuration will apply
//     "excludeEmployeeIds": ["60d5ecb8b3333356aef7e633", "60d5ecb8b3333356aef7e633"], those are the employees that this configurarion wont apply
//   },
// ]

// @desc    Add Configuration Setup To Printer
// @route   PATCH /printers/:printerId/addConfigurationSetupToPrinter
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { printerId: Types.ObjectId };
  }
) => {
  try {
    const printerId = context.params.printerId;
    const {
      mainCategory, // single string
      subCategories, // array of strings
      salesPointIds, // array of sales point ids
      excludeEmployeeIds, // array of employee ids
    } = (await req.json()) as IConfigurationSetupToPrintOrders;

    // validate printerId
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid printId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // check salesPointIds is a valid array of ObjectIds and mainCategory is not empty
    if (
      !salesPointIds ||
      salesPointIds.length === 0 ||
      !Array.isArray(salesPointIds) ||
      isObjectIdValid(salesPointIds) !== true ||
      !mainCategory
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "salesPointIds is required and must be an array of ObjectIds!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // if excludeEmployeeIds is provided, check if it is a valid array of ObjectIds
    if (excludeEmployeeIds) {
      if (
        !Array.isArray(excludeEmployeeIds) ||
        excludeEmployeeIds.length === 0 ||
        isObjectIdValid(excludeEmployeeIds) !== true
      ) {
        return new NextResponse(
          JSON.stringify({
            message: "ExcludeEmployeeIds must be an array of ObjectIds!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // if subCategories is provided, check if it is an array of strings
    if (subCategories) {
      if (!Array.isArray(subCategories) || subCategories.length === 0) {
        return new NextResponse(
          JSON.stringify({
            message: "SubCategories must be an array of strings!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    // Check if the combination of mainCategory and any of the subCategories already exists
    const existingCombination = await Printer.findOne({
      _id: printerId,
      configurationSetupToPrintOrders: {
        $elemMatch: {
          mainCategory,
          $or: [
            { subCategories: { $exists: false } },
            { subCategories: { $size: 0 } },
            { subCategories: { $in: subCategories } },
          ],
        },
      },
    }).lean();

    if (existingCombination) {
      return new NextResponse(
        JSON.stringify({
          message:
            "A combination of these mainCategory and subCategories already exists!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update the printer in a single query
    const updatedPrinter = await Printer.findOneAndUpdate(
      {
        _id: printerId,
      },
      {
        $push: {
          configurationSetupToPrintOrders: {
            mainCategory,
            subCategories,
            salesPointIds,
            excludeEmployeeIds,
          },
        },
      },
      { new: true, lean: true }
    );

    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({
          message: "PrinterId not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message:
          "Configuration setup to print orders add to printer successfully",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError(
      "Configuration setup to print orders creation failed!",
      error
    );
  }
};
