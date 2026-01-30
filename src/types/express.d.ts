import "express";
import { YooKassaWebhookPayload } from "./yookassa.types";

declare module "express-serve-static-core" {
  interface Request {
    correlationId: string;
    validatedWebhookPayload?: YooKassaWebhookPayload;
  }
}
