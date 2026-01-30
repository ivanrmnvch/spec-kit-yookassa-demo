import { YookassaService } from "../yookassa.service";
import { IYookassaService } from "../../interfaces/services/IYookassaService";
import {
  YooKassaCreatePaymentRequest,
  YooKassaPaymentResponse,
} from "../../types/yookassa.types";

/**
 * Adapter for YookassaService static class
 * Implements IYookassaService interface and delegates to static methods
 * Enables dependency injection of static service through Dependency Inversion Principle
 */
export class YookassaServiceAdapter implements IYookassaService {
  /**
   * Create a payment in YooKassa
   * Delegates to YookassaService.createPayment()
   */
  async createPayment(
    request: YooKassaCreatePaymentRequest,
    idempotenceKey: string
  ): Promise<YooKassaPaymentResponse> {
    return YookassaService.createPayment(request, idempotenceKey);
  }

  /**
   * Get payment from YooKassa by ID
   * Delegates to YookassaService.getPayment()
   */
  async getPayment(
    paymentId: string,
    correlationId?: string
  ): Promise<YooKassaPaymentResponse | null> {
    return YookassaService.getPayment(paymentId, correlationId);
  }
}

