import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";

// import models
import SupplierGood from "@/app/lib/models/supplierGood";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import { handleApiError } from "@/app/utils/handleApiError";
import { updateDynamicCountFromLastInventory } from "./utils/updateDynamicCountFromLastInventory";

// @desc    Get all supplier goods
// @route   GET /supplierGoods
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const supplierGoods = await SupplierGood.find()
      // .populate("supplier", "tradeName")
      .lean();

    return !supplierGoods.length
      ? new NextResponse("No supplier goods found!!", { status: 404 })
      : new NextResponse(JSON.stringify(supplierGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all supplier goods failed!", error);
  }
};

// @desc    Create new supplier good
// @route   POST /supplierGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      name,
      keyword,
      category,
      subCategory,
      currentlyInUse,
      supplier,
      business,
      description,
      allergens,
      budgetImpact,
      image,
      saleUnit,
      wholeSalePrice,
      measurementUnit,
      totalQuantityPerUnit,
      parLevel,
      minimumQuantityRequired,
      inventorySchedule,
      dynamicCountFromLastInventory,
    } = (await req.json()) as ISupplierGood;

    // check required fields
    if (
      !name ||
      !keyword ||
      !category ||
      !subCategory ||
      currentlyInUse === undefined ||
      !supplier ||
      !business
    ) {
      return new NextResponse(
        "Name, keyword, category, subCategory, currentlyInUse, supplier and business are required!",
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if the supplier good already exists
    const duplicateSupplierGood = await SupplierGood.findOne({
      business,
      name,
    });

    if (duplicateSupplierGood) {
      return new NextResponse(`${name} already exists on supplier goods!`, {
        status: 400,
      });
    }

    // Create a supplier good object with required fields
    const supplierGoodObj: ISupplierGood = {
      name,
      keyword,
      category: {
        mainCategory: category as unknown as string,
        foodSubCategory: undefined,
        beverageSubCategory: undefined,
        merchandiseSubCategory: undefined,
        cleaningSubCategory: undefined,
        officeSubCategory: undefined,
        furnitureSubCategory: undefined,
        disposableSubCategory: undefined,
        servicesSubCategory: undefined,
        equipmentSubCategory: undefined,
        othersSubCategory: undefined,
      },
      currentlyInUse,
      supplier,
      business,
      description: description || undefined,
      allergens: allergens || undefined,
      budgetImpact: budgetImpact || undefined,
      image: image || undefined,
      saleUnit: saleUnit || undefined,
      wholeSalePrice: wholeSalePrice || undefined,
      measurementUnit: measurementUnit || undefined,
      totalQuantityPerUnit: totalQuantityPerUnit || undefined,
      pricePerUnit:
        wholeSalePrice && totalQuantityPerUnit
          ? wholeSalePrice / totalQuantityPerUnit
          : undefined,
      parLevel: parLevel || undefined,
      minimumQuantityRequired: minimumQuantityRequired || undefined,
      inventorySchedule: inventorySchedule || undefined,
      // upon creation, the dynamicCountFromLastInventory is the current quantity purchased from the supplier
      // its required if business is to start using the inventory module
      // IMPORTANT *** THAT NUMBER IS THE START POINT FOR THE INVENTORY COUNT
      dynamicCountFromLastInventory: dynamicCountFromLastInventory || undefined,
    };

    // set the category and subcategory
    switch (category as unknown as string) {
      case "Food":
        supplierGoodObj.category.foodSubCategory = subCategory;
        break;
      case "Beverage":
        supplierGoodObj.category.beverageSubCategory = subCategory;
        break;
      case "Merchandise":
        supplierGoodObj.category.merchandiseSubCategory = subCategory;
        break;
      case "Cleaning":
        supplierGoodObj.category.cleaningSubCategory = subCategory;
        break;
      case "Office":
        supplierGoodObj.category.officeSubCategory = subCategory;
        break;
      case "Furniture":
        supplierGoodObj.category.furnitureSubCategory = subCategory;
        break;
      case "Disposable":
        supplierGoodObj.category.disposableSubCategory = subCategory;
        break;
      case "Services":
        supplierGoodObj.category.servicesSubCategory = subCategory;
        break;
      case "Equipment":
        supplierGoodObj.category.equipmentSubCategory = subCategory;
        break;
      case "Others":
        supplierGoodObj.category.othersSubCategory = subCategory;
        break;
      default:
        supplierGoodObj.category.merchandiseSubCategory = "No subcategory";
        break;
    }

    // create a new supplier good
    await SupplierGood.create(supplierGoodObj);

    // confirm supplier good was created
    return new NextResponse(`Supplier good ${name} created successfully!`, {
      status: 201,
    });
  } catch (error) {
    return handleApiError("Create supplier good failed!", error);
  }
};

// export const POST = async (req: Request) => {
//   try {
//     const supplierGoodId = "6679367f607463b1e8782e43";
//     const updatedCountQuantity = 10;

//     // @ts-ignore
//     const result = await updateDynamicCountFromLastInventory(supplierGoodId, updatedCountQuantity);

//     return new NextResponse(JSON.stringify(result), {
//       status: 201, headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Create schedule failed!", error);
//   }
// };
