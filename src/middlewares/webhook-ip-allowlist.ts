import { Request, Response, NextFunction } from "express";
import ipaddr from "ipaddr.js";

import { extractClientIp } from "./webhook-client-ip";
import { logger } from "../utils/logger";

/**
 * YooKassa IP address ranges for webhook allowlist
 * Source: https://yookassa.ru/developers/using-api/webhooks#ip
 * 
 * IPv4 CIDR ranges:
 * - 185.71.76.0/27
 * - 185.71.77.0/27
 * - 77.75.153.0/25
 * - 77.75.154.128/25
 * 
 * IPv4 single addresses:
 * - 77.75.156.11
 * - 77.75.156.35
 * 
 * IPv6 CIDR range:
 * - 2a02:5180::/32
 */
const YOOKASSA_IP_RANGES = [
  // IPv4 CIDR ranges
  { type: "ipv4", cidr: "185.71.76.0/27" },
  { type: "ipv4", cidr: "185.71.77.0/27" },
  { type: "ipv4", cidr: "77.75.153.0/25" },
  { type: "ipv4", cidr: "77.75.154.128/25" },
  // IPv4 single addresses
  { type: "ipv4", address: "77.75.156.11" },
  { type: "ipv4", address: "77.75.156.35" },
  // IPv6 CIDR range
  { type: "ipv6", cidr: "2a02:5180::/32" },
] as const;

/**
 * Check if an IP address is in the YooKassa allowlist
 * @param ip - IP address to check (IPv4 or IPv6)
 * @returns true if IP is in allowlist, false otherwise
 */
function isIpInAllowlist(ip: string): boolean {
  try {
    const parsedIp = ipaddr.process(ip);
    const ipKind = parsedIp.kind();

    for (const range of YOOKASSA_IP_RANGES) {
      if (range.type === "ipv4" && ipKind === "ipv4") {
        const ipv4 = parsedIp as ipaddr.IPv4;
        
        if ("address" in range) {
          // Single IP address
          if (ipv4.toString() === range.address) {
            return true;
          }
        } else if ("cidr" in range) {
          // CIDR range - use matchCIDR helper
          const [network, prefixLength] = range.cidr.split("/");
          const networkAddr = ipaddr.parse(network) as ipaddr.IPv4;
          const prefixLen = parseInt(prefixLength, 10);
          
          // Check if IP is in the same subnet
          const ipBytes = ipv4.octets;
          const networkBytes = networkAddr.octets;
          const bytesToCheck = Math.floor(prefixLen / 8);
          const bitsToCheck = prefixLen % 8;
          
          let matches = true;
          for (let i = 0; i < bytesToCheck; i++) {
            if (ipBytes[i] !== networkBytes[i]) {
              matches = false;
              break;
            }
          }
          
          if (matches && bitsToCheck > 0) {
            const mask = 0xff << (8 - bitsToCheck);
            if ((ipBytes[bytesToCheck] & mask) !== (networkBytes[bytesToCheck] & mask)) {
              matches = false;
            }
          }
          
          if (matches) {
            return true;
          }
        }
      } else if (range.type === "ipv6" && ipKind === "ipv6") {
        if ("cidr" in range) {
          // IPv6 CIDR range
          const ipv6 = parsedIp as ipaddr.IPv6;
          const [network, prefixLength] = range.cidr.split("/");
          const networkAddr = ipaddr.parse(network) as ipaddr.IPv6;
          const prefixLen = parseInt(prefixLength, 10);
          
          // Check if IP is in the same subnet
          const ipParts = ipv6.parts;
          const networkParts = networkAddr.parts;
          const partsToCheck = Math.floor(prefixLen / 16);
          const bitsToCheck = prefixLen % 16;
          
          let matches = true;
          for (let i = 0; i < partsToCheck; i++) {
            if (ipParts[i] !== networkParts[i]) {
              matches = false;
              break;
            }
          }
          
          if (matches && bitsToCheck > 0) {
            const mask = 0xffff << (16 - bitsToCheck);
            if ((ipParts[partsToCheck] & mask) !== (networkParts[partsToCheck] & mask)) {
              matches = false;
            }
          }
          
          if (matches) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    // Invalid IP address format
    logger.warn({ ip, error }, "Failed to parse IP address for allowlist check");
    return false;
  }
}

/**
 * Middleware to enforce IP allowlist for webhook endpoints
 * Rejects requests from non-YooKassa IPs with 403 Forbidden
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function webhookIpAllowlistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || "unknown";
  const clientIp = extractClientIp(req);

  if (!isIpInAllowlist(clientIp)) {
    logger.warn(
      {
        correlationId,
        clientIp,
        path: req.path,
      },
      "Webhook request from non-allowlisted IP"
    );

    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Webhook requests are only accepted from YooKassa IP addresses",
      },
    });
    return;
  }

  logger.debug(
    {
      correlationId,
      clientIp,
    },
    "Webhook IP allowlist check passed"
  );

  next();
}

