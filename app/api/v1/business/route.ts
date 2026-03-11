import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import mongoose from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import objDefaultValidation from "@/lib/utils/objDefaultValidation";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";

// imported interface
import { IBusiness } from "@/lib/interface/IBusiness";

// imported models
import Business from "@/lib/db/models/business";

// imported enums
import { subscriptionEnums, currenctyEnums } from "@/lib/enums";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const reqAddressFields = [
  "country",
  "state",
  "city",
  "street",
  "buildingNumber",
  "postCode",
];

const nonReqAddressFields = ["region", "additionalDetails", "coordinates"];

const DEFAULT_DISCOVERY_LIMIT = 50;

/** Approximate distance in km between two points (Haversine). Coords: [longitude, latitude]. */
function haversineKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// @desc    Get all businesses (optional filters: cuisineType, categories, name, rating, lat, lng, radius)
// @route   GET /business
// @access  Private
export const GET = async (req: Request) => {
  try {
    await connectDb();

    const url = new URL(req.url);
    const cuisineType = url.searchParams.get("cuisineType") ?? undefined;
    const categoriesParam = url.searchParams.get("categories") ?? undefined;
    const name = url.searchParams.get("name") ?? url.searchParams.get("tradeName") ?? undefined;
    const minRatingParam = url.searchParams.get("rating") ?? url.searchParams.get("minRating") ?? undefined;
    const latParam = url.searchParams.get("lat") ?? undefined;
    const lngParam = url.searchParams.get("lng") ?? undefined;
    const radiusKmParam = url.searchParams.get("radius") ?? undefined;
    const limitParam = url.searchParams.get("limit") ?? undefined;

    const hasFilters =
      cuisineType !== undefined ||
      categoriesParam !== undefined ||
      name !== undefined ||
      minRatingParam !== undefined ||
      (latParam !== undefined && lngParam !== undefined);

    let business: unknown[];

    if (!hasFilters) {
      business = await Business.find().select("-password").lean();
    } else {
      const filter: Record<string, unknown> = {};

      if (cuisineType) filter.cuisineType = cuisineType;

      if (categoriesParam) {
        const categories = categoriesParam
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (categories.length > 0)
          filter.categories = { $in: categories };
      }

      if (name) {
        filter.tradeName = { $regex: name, $options: "i" };
      }

      if (minRatingParam !== undefined && minRatingParam !== "") {
        const minRating = Number(minRatingParam);
        if (!Number.isNaN(minRating) && minRating >= 0 && minRating <= 5) {
          filter.averageRating = { $gte: minRating };
          filter.ratingCount = { $gte: 1 };
        }
      }

      const limit = limitParam
        ? Math.min(Math.max(1, Number(limitParam) || DEFAULT_DISCOVERY_LIMIT), 100)
        : DEFAULT_DISCOVERY_LIMIT;

      business = await Business.find(filter)
        .select("-password")
        .limit(limit)
        .lean();
    }

    if (latParam !== undefined && lngParam !== undefined && business.length > 0) {
      const lat = Number(latParam);
      const lng = Number(lngParam);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        const radiusKm =
          radiusKmParam !== undefined && radiusKmParam !== ""
            ? Number(radiusKmParam)
            : null;

        type BizWithCoords = { address?: { coordinates?: [number, number] }; [key: string]: unknown };
        const withCoords = (business as BizWithCoords[]).filter(
          (b) =>
            Array.isArray(b.address?.coordinates) &&
            b.address.coordinates.length >= 2
        );
        const withDistance = withCoords.map((b) => {
          const [lon, coordLat] = (b.address as { coordinates: [number, number] }).coordinates;
          const km = haversineKm(lng, lat, lon, coordLat);
          return { ...b, _distanceKm: km };
        });
        const filtered =
          radiusKm !== null && !Number.isNaN(radiusKm)
            ? withDistance.filter((b) => (b as { _distanceKm: number })._distanceKm <= radiusKm)
            : withDistance;
        const sorted = [...filtered].sort(
          (a, b) =>
            (a as { _distanceKm: number })._distanceKm -
            (b as { _distanceKm: number })._distanceKm
        );
        business = sorted.map(({ _distanceKm, ...rest }) => rest);
      }
    }

    return !business.length
      ? new NextResponse(JSON.stringify({ message: "No business found!" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(business), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all business failed!", error as string);
  }
};

// @desc    Create new business
// @route   POST /business
// @access  Private
export const POST = async (req: Request) => {
  // metrics is created upon updating the business
  // imageUrl are create or delete using cloudinaryActions routes
  try {
    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract fields from formData
    const tradeName = formData.get("tradeName") as string;
    const legalName = formData.get("legalName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const taxNumber = formData.get("taxNumber") as string;
    const subscription = formData.get("subscription") as string;
    const address = JSON.parse(formData.get("address") as string);
    const currencyTrade = formData.get("currencyTrade") as string;
    const contactPerson = formData.get("contactPerson") as string | undefined;
    const imageUrl = formData.get("imageUrl") as File | undefined;
    const cuisineType = formData.get("cuisineType") as string | undefined;
    const categoriesStr = formData.get("categories") as string | undefined;
    const averageRatingStr = formData.get("averageRating") as string | undefined;
    const ratingCountStr = formData.get("ratingCount") as string | undefined;
    const acceptsDeliveryStr = formData.get("acceptsDelivery") as string | undefined;
    const deliveryRadiusStr = formData.get("deliveryRadius") as string | undefined;
    const minOrderStr = formData.get("minOrder") as string | undefined;

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !password ||
      !phoneNumber ||
      !taxNumber ||
      !subscription ||
      !address ||
      !currencyTrade
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "TradeName, legalName, email, password, phoneNumber, taxNumber, subscription, currencyTrade and address are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check email format
    if (!emailRegex.test(email)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid email format!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check password format
    if (!passwordRegex.test(password)) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character!",
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

    // check if subscription is valid
    if (!subscriptionEnums.includes(subscription)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid subscription!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if currencyTrade is valid
    if (!currenctyEnums.includes(currencyTrade)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid currencyTrade!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate legalName, email or taxNumber
    const duplicateBusiness = await Business.exists({
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateBusiness) {
      return new NextResponse(
        JSON.stringify({
          message: `Business ${legalName}, ${email} or ${taxNumber} already exists!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // hash password
    const hashedPassword = await hash(password, 10);

    const businessId = new mongoose.Types.ObjectId();

    // create business object with required fields
    const newBusiness: IBusiness = {
      _id: businessId,
      tradeName: tradeName,
      legalName: legalName,
      email: email,
      password: hashedPassword,
      phoneNumber: phoneNumber,
      taxNumber: taxNumber,
      currencyTrade: currencyTrade,
      subscription: subscription,
      address: address,
      contactPerson: contactPerson || undefined,
    };
    if (cuisineType) newBusiness.cuisineType = cuisineType;
    if (categoriesStr) {
      try {
        const parsed = JSON.parse(categoriesStr) as string[];
        if (Array.isArray(parsed))
          newBusiness.categories = parsed.map((s) => s.trim().toLowerCase()).filter(Boolean);
      } catch {
        // ignore invalid JSON
      }
    }
    if (averageRatingStr !== undefined && averageRatingStr !== "") {
      const n = Number(averageRatingStr);
      if (!Number.isNaN(n) && n >= 0 && n <= 5) newBusiness.averageRating = n;
    }
    if (ratingCountStr !== undefined && ratingCountStr !== "") {
      const n = Number(ratingCountStr);
      if (!Number.isNaN(n) && n >= 0) newBusiness.ratingCount = n;
    }
    if (acceptsDeliveryStr !== undefined && acceptsDeliveryStr !== "")
      newBusiness.acceptsDelivery = acceptsDeliveryStr === "true";
    if (deliveryRadiusStr !== undefined && deliveryRadiusStr !== "") {
      const n = Number(deliveryRadiusStr);
      if (!Number.isNaN(n) && n >= 0) newBusiness.deliveryRadius = n;
    }
    if (minOrderStr !== undefined && minOrderStr !== "") {
      const n = Number(minOrderStr);
      if (!Number.isNaN(n) && n >= 0) newBusiness.minOrder = n;
    }

    if (imageUrl && imageUrl instanceof File && imageUrl.size > 0) {
      const folder = `/business/${businessId}`;

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

      newBusiness.imageUrl = cloudinaryUploadResponse[0];
    }

    // Create new business
    await Business.create(newBusiness);

    return new NextResponse(
      JSON.stringify({ message: `Business ${legalName} created` }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Create business failed!", error as string);
  }
};
