import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { generateQrCode } from "./utils/generateQrCode";

// imported intefaces
import { ISalesPoint } from "@shared/interfaces/ISalesPoint";

// imported models
import SalesPoint from "@/lib/db/models/salesPoint";

// imported enums
import { salesPointTypeEnums } from "@/lib/enums";

// sales point are the physical locations where salesInstance can be made and gathered orders

// @desc Get all salesPoints
// @route GET /salesPoints
// @access Private
export const GET = async () => {
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
    return handleApiError("Get all salesPoints failed!", error as string);
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

    if (
      salesPointType !== undefined &&
      salesPointType !== "" &&
      !salesPointTypeEnums.includes(salesPointType.toLowerCase())
    ) {
      return new NextResponse(
        JSON.stringify({
          message: `salesPointType must be one of: ${salesPointTypeEnums.join(", ")}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    if (salesPointType?.toLowerCase() === "delivery") {
      const existingDelivery = await SalesPoint.exists({
        businessId,
        salesPointType: "delivery",
      });
      if (existingDelivery) {
        return new NextResponse(
          JSON.stringify({
            message: "This business already has a delivery sales point.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

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

    const normalizedType = salesPointType
      ? salesPointType.toLowerCase()
      : undefined;

    // create salesPoint object
    const newSalesPoint = {
      salesPointName,
      salesPointType: normalizedType,
      selfOrdering: selfOrdering !== undefined ? selfOrdering : false,
      qrEnabled: qrEnabled !== undefined ? qrEnabled : true,
      businessId,
    };

    // create salesPoint
    const salesPointCreated = await SalesPoint.create(newSalesPoint);

    const isDelivery = normalizedType === "delivery";

    if (!isDelivery) {
      // Generate QR code after successful create (encodes salesPointId for open-table / self-order)
      const qrCode = await generateQrCode(businessId, salesPointCreated._id);

      if (!qrCode || qrCode.includes("Failed")) {
        await SalesPoint.deleteOne({ _id: salesPointCreated._id });
        return NextResponse.json(
          { message: "Failed to generate QR code, rollback applied" },
          { status: 500 }
        );
      }
      await SalesPoint.updateOne(
        { _id: salesPointCreated._id },
        { $set: { qrCode } }
      );
    }

    return NextResponse.json(
      { message: "Sales Point created" },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("Sales location creation failed!", error as string);
  }
};
