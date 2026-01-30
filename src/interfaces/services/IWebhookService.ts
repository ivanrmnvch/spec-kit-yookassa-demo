import { YooKassaWebhookPayload } from "../../types/yookassa.types";

/**
 * Webhook processing result
 */
export interface WebhookProcessingResult {
  processed: boolean;
  restored?: boolean;
  statusUpdated?: boolean;
  paymentId?: string;
  reason?: string;
}

/**
 * Interface for webhook service operations
 * Enables dependency injection of webhook service through Dependency Inversion Principle
 */
export interface IWebhookService {
  /**
   * Process webhook notification
   * Flow: verify → restore if missing → update status
   * 
   * Decision points:
   * 1. Verification: Check if payment exists in YooKassa (source of truth)
   * 2. Status validation: Check if webhook status matches verified status
   * 3. Restoration: Check if payment exists locally, restore if missing
   * 4. Status update: Update status using state machine (idempotent)
   * 
   * @param payload - Webhook payload from YooKassa
   * @param correlationId - Correlation ID for logging
   * @returns Processing result
   */
  processWebhook(
    payload: YooKassaWebhookPayload,
    correlationId: string
  ): Promise<WebhookProcessingResult>;
}

