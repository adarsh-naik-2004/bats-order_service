import productCacheModel from "./productCacheModel";

// Define type for price dimension configuration
type PriceDimension = {
  _id?: string;
  priceType: string;
  availableOptions: Record<string, number | null>;
};

export const handleProductUpdate = async (value: string) => {
  const message = JSON.parse(value);
  const product = message.data;

  // Deep clean priceConfiguration by removing nested _id fields
  const cleanedPriceConfig: Record<string, Omit<PriceDimension, '_id'>> = {};
  
  for (const [dimension, config] of Object.entries(product.priceConfiguration)) {
    // Safe type casting with fallback
    const typedConfig = config as PriceDimension;
    const { ...cleanConfig } = typedConfig;
    
    // Clean availableOptions - remove null values
    if (cleanConfig.availableOptions) {
      cleanConfig.availableOptions = Object.fromEntries(
        Object.entries(cleanConfig.availableOptions)
          .filter(([value]) => value !== null)
      );
    }
    
    cleanedPriceConfig[dimension] = cleanConfig;
  }

  try {
    await productCacheModel.updateOne(
      { productId: product.id },
      {
        $set: {
          productId: product.id,
          priceConfiguration: cleanedPriceConfig,
        },
      },
      { upsert: true }
    );
    
    console.log(`✅ Updated cache for product: ${product.id}`);
  } catch (err) {
    if (err instanceof Error) {
      console.error(`❌ Failed to update cache for ${product.id}:`, err.message);
    } else {
      console.error(`❌ Failed to update cache for ${product.id}:`, String(err));
    }
  }
};