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

// this route will edit individual configurationSetupToPrintOrders references from the printer
// @desc    Delete sales location
// @route   PATCH /printers/:printerId/editConfigurationSetupFromPrinter/:configurationSetupToPrintOrdersId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: {
      printerId: Types.ObjectId;
      configurationSetupToPrintOrdersId: Types.ObjectId;
    };
  }
) => {
  try {
    const { printerId, configurationSetupToPrintOrdersId } = context.params;
    const { mainCategory, subCategories, salesPointIds, excludeEmployeeIds } =
      (await req.json()) as IConfigurationSetupToPrintOrders;

    // Validate input
    if (
      isObjectIdValid([printerId, configurationSetupToPrintOrdersId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Invalid printerId or configurationSetupToPrintOrdersId!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
            message: "excludeEmployeeIds must be an array of ObjectIds!",
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
      if (!Array.isArray(subCategories)) {
        return new NextResponse(
          JSON.stringify({
            message: "subCategories must be an array of strings!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Connect to the database
    await connectDb();

    // Check if the combination of mainCategory and any of the subCategories already exists
    const existingCombination = await Printer.exists({
      _id: printerId,
      configurationSetupToPrintOrders: {
        $elemMatch: {
          _id: { $ne: configurationSetupToPrintOrdersId }, // Exclude current configurationSetupToPrintOrdersId
          mainCategory, // Ensure the mainCategory matches
          subCategories: { $in: subCategories }, // Check if any of the provided subCategories exists
        },
      },
    });

    if (existingCombination) {
      return new NextResponse(
        JSON.stringify({
          message:
            "A combination of this mainCategory and one of the subCategories already exists!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Proceed with updating the salesPonit printFor entry
    const updatedPrinter = await Printer.findOneAndUpdate(
      {
        _id: printerId,
        "configurationSetupToPrintOrders._id":
          configurationSetupToPrintOrdersId,
      },
      {
        $set: {
          "configurationSetupToPrintOrders.$.salesPointIds": salesPointIds, // Update salesPointIds
          "configurationSetupToPrintOrders.$.excludeEmployeeIds":
            excludeEmployeeIds, // Update excludeEmployeeIds
          "configurationSetupToPrintOrders.$.mainCategory": mainCategory, // Update mainCategories
          "configurationSetupToPrintOrders.$.subCategories": subCategories
            ? subCategories
            : [], // Update subCategories
        },
      },
      {
        new: true,
        lean: true,
      }
    );

    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({
          message: "Printer or configuration setup to print orders not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Configuration setup to print orders updated successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Update configuration setup to print orders failed!",
      error
    );
  }
};
