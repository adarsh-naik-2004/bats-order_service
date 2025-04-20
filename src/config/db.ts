import mongoose from "mongoose";
import config from "config";
import logger from "./logger";

const connectDB = async () => {
  try {

    const dbURI: string = config.get("database.url");

    mongoose.connection.on("connected", () => {
      logger.info("Connected to database successfully");
    });

    mongoose.connection.on("error", (err) => {
      logger.error("Error in connecting to database.", err);
    });

    await mongoose.connect(dbURI);
  } catch (err) {
    logger.error("Error in connecting to database.", err);
    process.exit(1);
  }
};

export default connectDB;
