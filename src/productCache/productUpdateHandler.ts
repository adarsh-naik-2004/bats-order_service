import productCacheModel from "./productCacheModel";

export const handleProductUpdate = async (value: string) => {
  const message = JSON.parse(value);

  const product = message.data;

  console.log("🔁 Handling product update for:", product.id );
  console.log("📦 Raw price config:", JSON.stringify(product.priceConfiguration, null, 2));

  try {
    const result = await productCacheModel.updateOne(
      { productId: product.id },
      {
        $set: {
          productId: product.id,
          priceConfiguration: product.priceConfiguration,
        },
      },
      { upsert: true }
    );

    console.log("✅ Mongo Update Result:", result);
  } catch (err) {
    console.error("❌ Mongo Update Error:", err);
  }

  const updated = await productCacheModel.findOne({ productId: product.id }).lean({ flattenMaps: true });
  console.log("📦 Final Document in DB:", JSON.stringify(updated, null, 2));
};
