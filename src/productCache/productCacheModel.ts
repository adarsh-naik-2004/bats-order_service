import mongoose from "mongoose";
import { ProductPricingCache } from "../types";

const priceSchema = new mongoose.Schema({
  priceType: {
    type: String,
    enum: ["base", "additional"],
    required: true
  },
  availableOptions: {
    type: Map,
    of: Number,
    required: true
  },
}, { _id: false });

const productCacheSchema = new mongoose.Schema<ProductPricingCache>(
  {
    productId: {
      type: String,
      required: true,
      unique: true
    },
    priceConfiguration: {
      type: Map,
      of: priceSchema,
      required: true
    },
  },
  {
    timestamps: true,
    toObject:  { flattenMaps: true },  // ← here
    toJSON:    { flattenMaps: true },  // ← and here
  }
);

export default mongoose.model(
  "ProductPricingCache",
  productCacheSchema,
  "productCache",
);
