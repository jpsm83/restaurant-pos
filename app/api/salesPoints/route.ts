import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { generateQrCode } from "./utils/generateQrCode";

// imported intefaces
import { ISalesPoint } from "@/app/lib/interface/ISalesPoint";

// imported models
import SalesPoint from "@/app/lib/models/salesPoint";

// sales point are the physical locations where salesInstance can be made and gathered orders

// @desc Get all salesPoints
// @route GET /salesPoints
// @access Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    // get all salesPoints
    const salesPoints = await SalesPoint.find().lean();

    return !salesPoints.length
      ? new NextResponse(JSON.stringify({ message: "No salesPoints found!" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(salesPoints), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all salesPoints failed!", error);
  }
};

// @desc Create new salesPoint
// @route POST /salesPoints
// @access Private
export const POST = async (req: Request) => {
  try {
    const {
      salesPointName,
      salesPointType,
      selfOrdering,
      qrEnabled,
      businessId,
    } = (await req.json()) as ISalesPoint;

    // check required fields
    if (!salesPointName || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message: "SalesPointName and businessId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate businessId
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate salesPoint
    const duplicateSalesPoint = await SalesPoint.exists({
      businessId,
      salesPointName,
    });

    if (duplicateSalesPoint) {
      return new NextResponse(
        JSON.stringify({
          message: "SalesPoint already exists!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // create salesPoint object
    const newSalesPoint = {
      salesPointName,
      salesPointType: salesPointType || undefined,
      selfOrdering: selfOrdering !== undefined ? selfOrdering : false,
      qrEnabled: qrEnabled !== undefined ? qrEnabled : true,
      businessId,
    };

    // create salesPoint
    const salesPointCreated = await SalesPoint.create(newSalesPoint);

    // Generate QR code after successful update
    const qrCode = await generateQrCode(businessId);
    if (!qrCode || qrCode.includes("Failed")) {
      // if QR code generation fails, remove the newly created sales location
      await SalesPoint.deleteOne({ _id: salesPointCreated._id });

      return NextResponse.json(
        { message: "Failed to generate QR code, rollback applied" },
        { status: 500 }
      );
    }

    // Update the new sales location with the QR code
    await SalesPoint.updateOne(
      { _id: salesPointCreated._id },
      { $set: { qrCode: qrCode } }
    );

    return NextResponse.json(
      { message: "Sales Point created" },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("Sales location creation failed!", error);
  }
};
