import { Types } from "mongoose";
import { NextResponse } from "next/server";

//imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Printer from "@/app/lib/models/printer";

// this route will delete individual configurationSetupToPrintOrders references from the printer
// @desc    Delete sales location
// @route   PATCH /printers/:printerId/deleteConfigurationSetupFromPrinter/:configurationSetupToPrintOrdersId
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

    // Connect to the database
    await connectDb();

    // Remove the specific printFor entry from the salesInstance's printFor array
    const updatedPrinter = await Printer.findOneAndUpdate(
      {
        _id: printerId,
      },
      {
        $pull: {
          configurationSetupToPrintOrders: {
            _id: configurationSetupToPrintOrdersId,
          },
        },
      },
      {
        new: true,
        lean: true,
      }
    );

    // If the printer or sales location is not found, return an error
    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({
          message: "Configuration setup to print orders not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Configuration setup to print orders successfully deleted!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Delete configuration setup to print orders failed!",
      error
    );
  }
};
