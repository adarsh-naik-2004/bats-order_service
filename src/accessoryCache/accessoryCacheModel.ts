import mongoose from "mongoose";
import { AccessoryPriceCache } from "../types";

const accessoryCacheSchama = new mongoose.Schema<AccessoryPriceCache>(
  {
    accessoryId: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    storeId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

accessoryCacheSchama.index({ accessoryId: 1 }, { unique: true });

export default mongoose.model(
  "AccessoryPricingCache",
  accessoryCacheSchama,
  "accessoryCache",
);
