import { AxiosError, type AxiosInstance } from "axios";

import { logger } from "../utils/logger";
import {
  YooKassaCreatePaymentRequest,
  YooKassaPaymentResponse,
} from "../types/yookassa.types";
import { IYookassaService } from "../interfaces/services/IYookassaService";

/**
 * YooKassa service
 * Handles communication with YooKassa API
 */
export class YookassaService implements IYookassaService {
  private readonly PAYMENTS_ENDPOINT = "/payments";

  constructor(private readonly axiosClient: AxiosInstance) {}

  /**
   * Create a payment in YooKassa
   * @param request - Payment creation request
   * @param idempotenceKey - UUID v4 idempotency key
   * @returns Payment response from YooKassa
   * @throws AxiosError if request fails
   */
  async createPayment(
    request: YooKassaCreatePaymentRequest,
    idempotenceKey: string
  ): Promise<YooKassaPaymentResponse> {
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
      const response = await this.axiosClient.post<YooKassaPaymentResponse>(
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

  /**
   * Get payment from YooKassa by ID
   * Used for webhook verification (source of truth)
   * @param paymentId - YooKassa payment ID
   * @param correlationId - Correlation ID for logging
   * @returns YooKassa payment response, or null if not found
   * @throws AxiosError if request fails (except 404)
   */
  async getPayment(
    paymentId: string,
    correlationId?: string
  ): Promise<YooKassaPaymentResponse | null> {
    const logCorrelationId = correlationId || logger.bindings().correlationId || "unknown";

    logger.info(
      {
        correlationId: logCorrelationId,
        paymentId,
      },
      "Fetching payment from YooKassa"
    );

    try {
      const response = await this.axiosClient.get<YooKassaPaymentResponse>(
        `${this.PAYMENTS_ENDPOINT}/${paymentId}`
      );

      logger.info(
        {
          correlationId: logCorrelationId,
          paymentId,
          status: response.data.status,
          paid: response.data.paid,
        },
        "Payment fetched from YooKassa"
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<unknown>;

      // Handle 404 (payment not found) as expected case
      if (axiosError.response?.status === 404) {
        logger.warn(
          {
            correlationId: logCorrelationId,
            paymentId,
          },
          "Payment not found in YooKassa (404)"
        );
        return null;
      }

      logger.error(
        {
          err: {
            message: axiosError.message,
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            code: axiosError.code,
          },
          correlationId: logCorrelationId,
          paymentId,
        },
        "Failed to fetch payment from YooKassa"
      );
      throw error;
    }
  }
}

