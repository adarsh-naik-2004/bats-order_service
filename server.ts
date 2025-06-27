import app from "./src/app";
import { Config } from "./src/config/index";
import logger from "./src/config/logger";
import connectDB from "./src/config/db";

const startServer = async () => {
  const PORT = Config.server.port;

  try {
    await connectDB();
    
    app
      .listen(PORT, () => console.log(`Order service listening on port ${PORT}`))
      .on("error", (err) => {
        console.log("Server error:", err.message);
        process.exit(1);
      });
  } catch (err) {
    logger.error("Error starting server:", err.message);
    process.exit(1);
  }
};

void startServer();