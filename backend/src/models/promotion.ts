import mongoose, { Schema, model } from "mongoose";
import * as enums from "../../../lib/enums.ts";

const { weekDaysEnums } = enums;

const promotionSchema = new Schema(
  {
    // required fields
    promotionName: { type: String, required: [true, "Promotion is required!"] }, // name of the promotion
    promotionPeriod: {
      type: {
        start: {
          type: Date,
          required: [true, "Promotion start period is required!"],
        }, // Combined start date and time
        end: {
          type: Date,
          required: [true, "Promotion end period is required!"],
        }, // Combined end date and time
      },
      required: [true, "Promotion period is required!"],
    }, // object with the range of the promotion
    weekDays: {
      type: [String],
      enum: weekDaysEnums,
      required: [true, "Week days are required!"],
    }, // days of the week when the promotion applies
    activePromotion: { type: Boolean, default: true }, // if the promotion is active or not
    promotionType: {
      type: {
        fixedPrice: { type: Number }, // fixed price of the promotion "from 15:00 to 17:00 all beers 2€"
        discountPercent: { type: Number }, // discount percent of the promotion "from 15:00 to 17:00 all beers 50% off"
        twoForOne: { type: Boolean }, // two for one promotion "from 15:00 to 17:00 all beers two for one"
        threeForTwo: { type: Boolean }, // three for two promotion "from 15:00 to 17:00 all beers three for two"
        secondHalfPrice: { type: Boolean }, // second half price promotion "from 15:00 to 17:00 buy one beer get second half price"
        fullComplimentary: { type: Boolean }, // full complimentary promotion "from 15:00 to 17:00 all beers are free"
      },
      required: [true, "Promotion type is required!"],
    }, // type of the promotion
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    },

    // optional fields
    businessGoodsToApplyIds: {
      type: [Schema.Types.ObjectId],
      ref: "BusinessGood",
      default: undefined,
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business goods that the promotion will apply to
    description: { type: String }, // description of the promotion
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Promotion = mongoose.models.Promotion || model("Promotion", promotionSchema);
export default Promotion;
