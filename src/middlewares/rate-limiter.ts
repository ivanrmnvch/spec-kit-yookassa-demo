import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import { getRedisClient } from "../config/redis";
import { logger } from "../utils/logger";

/**
 * General API rate limiter: 100 requests per 15 minutes per IP.
 * Applies to all API endpoints except webhooks.
 */
export async function createGeneralRateLimiter() {
  const redisClient = await getRedisClient();

  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    store: new RedisStore({
      sendCommand: (...args: string[]) => {
        return redisClient.sendCommand(args);
      },
      prefix: "rl:api:",
    }),
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
      logger.warn(
        {
          correlationId: req.correlationId,
          ip: req.ip,
          path: req.path,
        },
        "General API rate limit exceeded",
      );
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Maximum 100 requests per 15 minutes.",
        },
      });
    },
    skip: (req: Request) => {
      // Skip rate limiting for webhook endpoint
      return req.path.startsWith("/api/webhooks");
    },
  });
}

/**
 * Payment creation rate limiter: 10 requests per 60 minutes per (IP + userId).
 * Stricter limit to prevent card testing and fraud.
 */
export async function createPaymentRateLimiter() {
  const redisClient = await getRedisClient();

  return rateLimit({
    windowMs: 60 * 60 * 1000, // 60 minutes (1 hour)
    max: 10, // 10 requests per window
    store: new RedisStore({
      sendCommand: (...args: string[]) => {
        return redisClient.sendCommand(args);
      },
      prefix: "rl:payment:",
    }),
    keyGenerator: (req: Request) => {
      // Key format: IP:userId (if userId exists in body)
      // Use ipKeyGenerator helper for proper IPv6 handling
      // For IPv6 loopback (::1), normalize to IPv4 equivalent or use as-is
      let ip = "unknown";
      if (req.ip) {
        // Handle IPv6 loopback - normalize to IPv4 equivalent
        if (req.ip === "::1" || req.ip === "::ffff:127.0.0.1") {
          ip = "127.0.0.1";
        } else {
          ip = ipKeyGenerator(req.ip);
        }
      }
      
      // Body should be parsed by express.json() at this point
      const userId = req.body?.userId || "unknown";
      return `${ip}:${userId}`;
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn(
        {
          correlationId: req.correlationId,
          ip: req.ip,
          userId: req.body?.userId,
        },
        "Payment creation rate limit exceeded",
      );
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many payment attempts. Maximum 10 payments per hour.",
        },
      });
    },
  });
}
