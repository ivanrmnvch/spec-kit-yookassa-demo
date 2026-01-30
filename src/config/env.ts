import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  YOOKASSA_SHOP_ID: z.string().min(1, "YOOKASSA_SHOP_ID is required"),
  YOOKASSA_SECRET_KEY: z.string().min(1, "YOOKASSA_SECRET_KEY is required"),
  YOOKASSA_BASE_URL: z.string().url().default("https://api.yookassa.ru/v3"),
  TRUSTED_PROXY: z
    .boolean()
    .default(false)
    .describe("Enable trusted proxy mode for X-Forwarded-For headers"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
