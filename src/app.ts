import 'dotenv/config';
import express from "express";

import { env } from "./config/env";
import { disconnectPrisma, getPrismaClient } from "./config/database";
import { disconnectRedis, getRedisClient } from "./config/redis";
import { correlationIdMiddleware } from "./middlewares/correlation-id";
import { errorHandlerMiddleware } from "./middlewares/error-handler";
import { requestLoggerMiddleware } from "./middlewares/request-logger";
import { logger } from "./utils/logger";
import { UserRepository } from "./repositories/user.repository";
import { PaymentRepository } from "./repositories/payment.repository";
import { IdempotencyService } from "./services/idempotency.service";
import { YookassaServiceAdapter } from "./services/adapters/yookassa-service.adapter";
import { PaymentsService } from "./services/payment.service";
import { WebhookService } from "./services/webhook.service";
import { createPaymentController } from "./controllers/payments.controller";
import { getPaymentController } from "./controllers/payments.controller";
import { processWebhookController } from "./controllers/webhooks.controller";
import { createPaymentsRoutes } from "./routes/payments";
import { createWebhooksRoutes } from "./routes/webhooks";
import healthRoutes from "./routes/health";

const app = express();

// Body parser middleware (MUST be before routes)
app.use(express.json());

app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

// Mount health routes (no dependencies)
app.use(healthRoutes);

const port = env.PORT;
let server: ReturnType<typeof app.listen> | null = null;

/**
 * Initialize all dependencies in correct order:
 * Redis → Prisma → Repositories → Adapters → Services → Controllers → Routes
 */
async function initializeDependencies(): Promise<void> {
  try {
    // Step 1: Initialize Prisma client
    logger.info("Initializing Prisma client...");
    const prisma = getPrismaClient();

    // Step 2: Explicitly connect Prisma before creating repositories
    logger.info("Connecting to database...");
    await prisma.$connect();
    logger.info("Database connection established");

    // Step 3: Create repository instances
    logger.info("Creating repository instances...");
    const userRepository = new UserRepository(prisma);
    const paymentRepository = new PaymentRepository(prisma);
    logger.info("Repository instances created");

    // Step 4: Initialize Redis connection
    logger.info("Initializing Redis connection...");
    const redisClient = await getRedisClient();
    logger.info("Redis connection established");

    // Step 5: Create service instances (IdempotencyService is now an instance class)
    logger.info("Creating service instances...");
    const idempotencyService = new IdempotencyService(redisClient);
    const yookassaService = new YookassaServiceAdapter();
    logger.info("Service instances created");

    // Step 6: Create payment and webhook service instances
    logger.info("Creating payment and webhook service instances...");
    const paymentsService = new PaymentsService(
      userRepository,
      paymentRepository,
      idempotencyService,
      yookassaService
    );
    const webhookService = new WebhookService(
      paymentRepository,
      paymentsService,
      yookassaService
    );
    logger.info("Payment and webhook service instances created");

    // Step 7: Create controller instances via factory functions
    logger.info("Creating controller instances...");
    const createPaymentControllerInstance = createPaymentController(paymentsService);
    const getPaymentControllerInstance = getPaymentController(paymentsService);
    const processWebhookControllerInstance = processWebhookController(webhookService);
    logger.info("Controller instances created");

    // Step 8: Create route instances via factory functions
    logger.info("Creating route instances...");
    const paymentsRoutes = createPaymentsRoutes(
      createPaymentControllerInstance,
      getPaymentControllerInstance
    );
    const webhooksRoutes = createWebhooksRoutes(processWebhookControllerInstance);
    logger.info("Route instances created");

    // Step 9: Mount routes
    logger.info("Mounting routes...");
    app.use("/api/payments", paymentsRoutes);
    app.use("/api/webhooks", webhooksRoutes);
    logger.info("Routes mounted successfully");

    // Step 10: Add error handler middleware (must be last)
    app.use(errorHandlerMiddleware);
    logger.info("Error handler middleware added");

    logger.info("All dependencies initialized successfully");
  } catch (error) {
    // Fail-fast: log full context and exit
    logger.error(
      {
        err: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        },
        dependency: "unknown",
      },
      "Failed to initialize dependencies"
    );
    process.exit(1);
  }
}

// Initialize Redis connection on startup
async function startServer() {
  try {
    // Initialize all dependencies before starting HTTP server
    await initializeDependencies();

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
