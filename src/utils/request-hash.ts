import { createHash } from "crypto";

/**
 * Generate a stable, deterministic hash for a JSON object
 * The hash is consistent for the same object structure and values
 *
 * @param obj - Object to hash
 * @returns SHA-256 hash as hexadecimal string
 */
export function hashRequest(obj: unknown): string {
  // Sort keys recursively to ensure deterministic output
  const normalized = normalizeObject(obj);

  // Convert to JSON string
  const jsonString = JSON.stringify(normalized);

  // Generate SHA-256 hash
  return createHash("sha256").update(jsonString).digest("hex");
}

/**
 * Normalize an object by sorting keys recursively
 * Ensures deterministic JSON output regardless of key order
 */
function normalizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeObject(item));
  }

  // Sort object keys and recursively normalize values
  const sortedEntries = Object.entries(obj)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => [key, normalizeObject(value)]);

  return Object.fromEntries(sortedEntries);
}

