import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { logger } from "../utils/logger";

const { Pool } = pg;

let prisma: PrismaClient | null = null;

/**
 * Get or create Prisma client singleton.
 * Connects to database on first call.
 */
export function getPrismaClient(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Create adapter
  const adapter = new PrismaPg(pool);

  // Create new client with adapter
  prisma = new PrismaClient({
    adapter,
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
