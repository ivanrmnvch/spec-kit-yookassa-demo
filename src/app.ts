import 'dotenv/config';
import express from "express";

import { env } from "./config/env";
import { disconnectPrisma } from "./config/database";
import { disconnectRedis, getRedisClient } from "./config/redis";
import { correlationIdMiddleware } from "./middlewares/correlation-id";
import { errorHandlerMiddleware } from "./middlewares/error-handler";
import { requestLoggerMiddleware } from "./middlewares/request-logger";
import routes from "./routes";
import { logger } from "./utils/logger";

const app = express();

app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

// Mount base routes
app.use("/", routes);

// Error handler must be last middleware
app.use(errorHandlerMiddleware);

const port = env.PORT;
let server: ReturnType<typeof app.listen> | null = null;

// Initialize Redis connection on startup
async function startServer() {
  try {
    // Connect to Redis
    await getRedisClient();
    logger.info("Redis connection established");

    // Start HTTP server
    server = app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to start server");
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, starting graceful shutdown");

  const shutdownTimeout = 10000; // 10 seconds
  const forceShutdownTimer = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, shutdownTimeout);

  try {
    // Close HTTP server (stop accepting new requests)
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          logger.info("HTTP server closed");
          resolve();
        });
      });
    }

    // Disconnect Redis
    await disconnectRedis();

    // Disconnect Prisma
    await disconnectPrisma();

    clearTimeout(forceShutdownTimer);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    clearTimeout(forceShutdownTimer);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start the server
startServer();
