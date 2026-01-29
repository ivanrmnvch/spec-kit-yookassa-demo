import { AxiosError } from "axios";

import { getYooKassaClient } from "../config/yookassa";
import { logger } from "../utils/logger";
import {
  YooKassaCreatePaymentRequest,
  YooKassaPaymentResponse,
} from "../types/yookassa.types";

/**
 * YooKassa service
 * Handles communication with YooKassa API
 */
export class YookassaService {
  private static readonly PAYMENTS_ENDPOINT = "/payments";

  /**
   * Create a payment in YooKassa
   * @param request - Payment creation request
   * @param idempotenceKey - UUID v4 idempotency key
   * @returns Payment response from YooKassa
   * @throws AxiosError if request fails
   */
  static async createPayment(
    request: YooKassaCreatePaymentRequest,
    idempotenceKey: string
  ): Promise<YooKassaPaymentResponse> {
    const client = getYooKassaClient();

    // Log request (redact sensitive data)
    logger.info(
      {
        idempotenceKey,
        amount: request.amount.value,
        currency: request.amount.currency,
        description: request.description,
      },
      "Creating payment in YooKassa"
    );

    try {
      const response = await client.post<YooKassaPaymentResponse>(
        this.PAYMENTS_ENDPOINT,
        request,
        {
          headers: {
            "Idempotence-Key": idempotenceKey,
          },
        }
      );

      // Log successful response
      logger.info(
        {
          idempotenceKey,
          yookassaPaymentId: response.data.id,
          status: response.data.status,
          paid: response.data.paid,
        },
        "Payment created in YooKassa"
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<unknown>;

      // Log error with context (redact sensitive data)
      logger.error(
        {
          err: {
            message: axiosError.message,
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            code: axiosError.code,
          },
          idempotenceKey,
          amount: request.amount.value,
          currency: request.amount.currency,
        },
        "Failed to create payment in YooKassa"
      );

      throw error;
    }
  }
}

