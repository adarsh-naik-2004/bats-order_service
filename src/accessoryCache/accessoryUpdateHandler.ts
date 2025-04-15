import { AccessoryMessage } from "../types";
import accessoryCacheModel from "./accessoryCacheModel";

export const handleAccessoryUpdate = async (value: string) => {
  const accessory: AccessoryMessage = JSON.parse(value);

  return await accessoryCacheModel.updateOne(
    {
      accessoryId: accessory.id,
    },
    {
      $set: {
        price: accessory.price,
        storeId: accessory.storeId,
      },
    },
    { upsert: true },
  );
};
