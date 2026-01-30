import { Request } from "express";
import { env } from "../config/env";

/**
 * Extract client IP from request, considering trusted proxy configuration
 * 
 * If TRUSTED_PROXY is enabled, checks X-Forwarded-For and X-Real-IP headers.
 * Otherwise, uses direct connection IP (req.ip or req.socket.remoteAddress).
 * 
 * @param req - Express request object
 * @returns Client IP address (IPv4 or IPv6)
 */
export function extractClientIp(req: Request): string {
  // If trusted proxy is enabled, check forwarded headers
  if (env.TRUSTED_PROXY === true) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // Take the first (original client) IP
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      const firstIp = ips.split(",")[0].trim();
      if (firstIp) {
        return firstIp;
      }
    }

    // Fallback to X-Real-IP
    const realIp = req.headers["x-real-ip"];
    if (realIp) {
      const ip = Array.isArray(realIp) ? realIp[0] : realIp;
      if (ip) {
        return ip.trim();
      }
    }
  }

  // Use direct connection IP (Express sets req.ip from trust proxy settings)
  // Fallback to socket remote address if req.ip is not set
  return req.ip || req.socket.remoteAddress || "unknown";
}

