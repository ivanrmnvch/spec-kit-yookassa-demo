import { createClient, type RedisClientType } from "redis";

import { env } from "./env";
import { logger } from "../utils/logger";

let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client singleton.
 * Connects to Redis on first call.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (redisClient && !redisClient.isOpen) {
    // Reconnect if client exists but is closed
    await redisClient.connect();
    logger.info("Redis client reconnected");
    return redisClient;
  }

  // Create new client
  redisClient = createClient({
    url: env.REDIS_URL,
  });

  // Error handling
  redisClient.on("error", (err) => {
    logger.error({ err }, "Redis client error");
  });

  redisClient.on("connect", () => {
    logger.info("Redis client connecting");
  });

  redisClient.on("ready", () => {
    logger.info("Redis client ready");
  });

  redisClient.on("reconnecting", () => {
    logger.info("Redis client reconnecting");
  });

  // Connect to Redis
  await redisClient.connect();
  logger.info("Redis client connected");

  return redisClient;
}

/**
 * Gracefully disconnect Redis client.
 * Should be called during application shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (!redisClient) {
    return;
  }

  if (redisClient.isOpen) {
    await redisClient.quit();
    logger.info("Redis client disconnected");
  }

  redisClient = null;
}

/**
 * Check if Redis client is connected.
 */
export function isRedisConnected(): boolean {
  return redisClient?.isOpen ?? false;
}
