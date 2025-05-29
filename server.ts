import app from "./src/app";
import { Config } from "./src/config/index";
import logger from "./src/config/logger";
import connectDB from "./src/config/db";
import { MessageBroker } from "./src/types/broker";
import { createMessageBroker } from "./src/common/factories/brokerFactory";

const startServer = async () => {
  const PORT = Config.server.port;

  let broker: MessageBroker | null = null;

  try {
    await connectDB();
    broker = createMessageBroker();
    await broker.connectProducer();

    await broker.connectConsumer();
    await broker.consumeMessage(["product", "accessory"], false);

    app
      .listen(PORT, () => console.log(`Listening on port ${PORT}`))
      .on("error", (err) => {
        console.log("err", err.message);
        process.exit(1);
      });
  } catch (err) {
    logger.error("Error happened: ", err.message);
    if (broker) {
      await broker.disconnectProducer();
      await broker.disconnectConsumer();
    }
    process.exit(1);
  }
};

void startServer();
