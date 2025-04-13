import mongoose from "mongoose";
import { Coupon } from "./couponTypes";

const couponSchema = new mongoose.Schema<Coupon>(
  {
    title: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    validUpto: {
      type: Date,
      required: true,
    },
    discount: {
      type: Number,
      required: true,
    },
    storeId: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

// Create index for faster lookup
couponSchema.index({ storeId: 1, code: 1 }, { unique: true });

export default mongoose.model("Coupon", couponSchema);
