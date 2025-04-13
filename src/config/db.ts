import mongoose from "mongoose";

import logger from "./logger";

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () => {
      logger.info("Connected to database successfully");
    });

    mongoose.connection.on("error", (err) => {
      logger.error("Error in connecting to database.", err);
    });

    mongoose.connect('mongodb://user:pass@localhost:27017/catlog_db?authSource=admin')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ Connection failed:', err))
  } catch (err) {
    logger.error("Error in connecting to database.", err);
    process.exit(1);
  }
};

export default connectDB;
