import mongoose, { Schema, model } from "mongoose";
import { applyActiveOnlySoftDelete, softDeleteSchemaFields } from "./softDelete.ts";

const companySchema = new Schema(
  {
    // required fields
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "Owner",
      required: [true, "Owner id is required!"],
      index: true,
    }, // the Owner that owns this tax entity
    country: {
      type: String,
      required: [true, "Country is required!"],
    }, // inherited from the owning Owner's portfolio country

    // optional fields — a draft Company may be incomplete
    legalName: { type: String }, // legal name of the taxpayer
    taxNumber: { type: String }, // tax number of the taxpayer
    ...softDeleteSchemaFields,
  },
  {
    timestamps: true,
    trim: true,
  }
);

// Uniqueness applies only to active Companies in the same country and only
// when the field is present, so a draft Company may stay incomplete.
companySchema.index(
  { country: 1, legalName: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted: false, legalName: { $type: "string" } },
  },
);
companySchema.index(
  { country: 1, taxNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted: false, taxNumber: { $type: "string" } },
  },
);

applyActiveOnlySoftDelete(companySchema);

const Company = mongoose.models.Company || model("Company", companySchema);
export default Company;
