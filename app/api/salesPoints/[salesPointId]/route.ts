import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported intefaces
import { ISalesPoint } from "@/app/lib/interface/ISalesPoint";

// imported models
import SalesPoint from "@/app/lib/models/salesPoint";
import { Types } from "mongoose";
import deleteCloudinaryImage from "../../cloudinaryActions/utils/deleteCloudinaryImage";

// sales point are the physical locations where salesInstance can be made and gathered orders

// @desc    Get promotion by ID
// @route   GET /salesPoints/:salesPointId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { salesPointId: Types.ObjectId } }
) => {
  try {
    const salesPointId = context.params.salesPointId;

    // check if salesPointId is valid
    if (isObjectIdValid([salesPointId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesPointId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // get salesPoint by salesPointId
    const salesPoint = await SalesPoint.findById(salesPointId).lean();

    return !salesPoint
      ? new NextResponse(JSON.stringify({ message: "No salesPoint found!" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(salesPoint), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get salesPoint by salesPoinId failed!", error);
  }
};

// @desc Update salesPoint by salesPointId
// @route PATCH /salesPoints/:salesPointId
// @access Private
export const PATCH = async (
  req: Request,
  context: {
    params: { salesPointId: Types.ObjectId };
  }
) => {
  try {
    const salesPointId = context.params.salesPointId;

    const { salesPointName, salesPointType, selfOrdering, qrEnabled } =
      (await req.json()) as ISalesPoint;

    // check if salesPointId is valid
    if (isObjectIdValid([salesPointId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesPointId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate salesPointName
    const salesPoint = await SalesPoint.findById(salesPointId);

    if (!salesPoint) {
      return new NextResponse(
        JSON.stringify({ message: "SalesPoint not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check for duplicate salesPointName
    const duplicateSalesPoint = await SalesPoint.exists({
      salesPointName,
      _id: { $ne: salesPointId },
      businessId: salesPoint.businessId,
    });

    if (duplicateSalesPoint) {
      return new NextResponse(
        JSON.stringify({ message: "SalesPointName already exists!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // create salesPoint object
    const updatedSalesPoint: Partial<ISalesPoint> = {};

    if (salesPointName) updatedSalesPoint.salesPointName = salesPointName;
    if (salesPointType) updatedSalesPoint.salesPointType = salesPointType;
    if (selfOrdering !== undefined)
      updatedSalesPoint.selfOrdering = selfOrdering;
    if (qrEnabled !== undefined) updatedSalesPoint.qrEnabled = qrEnabled;

    // update salesPoint
    await SalesPoint.updateOne(
      { _id: salesPointId },
      { $set: updatedSalesPoint }
    );

    return new NextResponse(
      JSON.stringify({
        message: "Sales point updated successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update salesPoint failed!", error);
  }
};

// @desc    Delete sales point
// @route   DELETE /salesPoint/:salesPointId
// @access  Private
export const DELETE = async (
  req: Request,
  context: {
    params: { salesPointId: Types.ObjectId };
  }
) => {
  try {
    const salesPointId = context.params.salesPointId;

    // validate salesPointId
    if (isObjectIdValid([salesPointId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesPointId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // get the salesPoint by salesPointId
    const salesPoint = await SalesPoint.findById(salesPointId);

    if (!salesPoint) {
      return new NextResponse(
        JSON.stringify({ message: "SalesPoint not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // example of a cloudinary image url
    // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesLocationQrCodes/66c9d6afc45a1547f9ab893b.png"
    const qrCode = salesPoint.qrCode;

    // delete salesPoint
    const result = await SalesPoint.deleteOne({
      _id: salesPointId,
    });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Sales location not found or it has orders!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const deleteCloudinaryImageResult = await deleteCloudinaryImage(qrCode);

    if (deleteCloudinaryImageResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: deleteCloudinaryImageResult }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Sales point deleted successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete business failed!", error);
  }
};
