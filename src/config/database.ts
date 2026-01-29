import { PrismaClient } from "@prisma/client";

import { logger } from "../utils/logger";

let prisma: PrismaClient | null = null;

/**
 * Get or create Prisma client singleton.
 * Connects to database on first call.
 */
export function getPrismaClient(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  // Create new client
  prisma = new PrismaClient({
    log: [
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
    ],
  });

  // Error handling
  prisma.$on("error", (e) => {
    logger.error({ error: e }, "Prisma error");
  });

  prisma.$on("warn", (e) => {
    logger.warn({ warning: e }, "Prisma warning");
  });

  return prisma;
}

/**
 * Gracefully disconnect Prisma client.
 * Should be called during application shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  logger.info("Prisma client disconnected");
  prisma = null;
}

/**
 * Check if Prisma client is initialized.
 */
export function isPrismaInitialized(): boolean {
  return prisma !== null;
}
