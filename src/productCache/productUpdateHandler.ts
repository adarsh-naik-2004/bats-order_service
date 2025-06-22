import productCacheModel from "./productCacheModel";

type PriceDimension = {
  _id?: string;
  priceType: string;
  availableOptions: Record<string, number | null>;
};

export const handleProductUpdate = async (value: string) => {
  try {
    const message = JSON.parse(value);

    const eventType = message.event_type;
    const productData = message.data;

    if (!productData || !productData.id || !productData.priceConfiguration) {
      console.log("Skipping invalid product message:", message);
      return;
    }

    if (eventType === "PRODUCT_CREATE" || eventType === "PRODUCT_UPDATE") {
      console.log(`Processing ${eventType} for product: ${productData.id}`);

      const cleanedPriceConfig: Record<string, Partial<PriceDimension>> = {};

      for (const [dimension, config] of Object.entries(
        productData.priceConfiguration,
      )) {
        const typedConfig = config as PriceDimension;

        const cleanConfig: Partial<PriceDimension> = {
          priceType: typedConfig.priceType,
          availableOptions: {},
        };

        if (typedConfig.availableOptions) {
          for (const [option, price] of Object.entries(
            typedConfig.availableOptions,
          )) {
            if (price !== null) {
              cleanConfig.availableOptions![option] = price;
            }
          }
        }

        cleanedPriceConfig[dimension] = cleanConfig;
      }

      const updateDoc = {
        productId: productData.id,
        priceConfiguration: cleanedPriceConfig,
      };

      const result = await productCacheModel.updateOne(
        { productId: productData.id },
        { $set: updateDoc },
        { upsert: true },
      );

      console.log(
        `✅ ${result.upsertedId ? "Created" : "Updated"} cache for product: ${productData.id}`,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Failed to process message: ${value}`, error.message);
    } else {
      console.error(`❌ Failed to process message: ${value}`, String(error));
    }
  }
};
