/**
 * YooKassa API Types
 * Based on YooKassa API v3 documentation
 * All types are strictly typed without using `any`
 */

/**
 * Amount object with value and currency
 */
export interface YooKassaAmount {
  value: string; // Format: "100.00" (decimal with 2 decimal places)
  currency: "RUB";
}

/**
 * Confirmation object for payment
 */
export interface YooKassaConfirmation {
  type: "redirect" | "embedded" | "qr" | "external";
  return_url?: string; // Required for redirect type
  confirmation_url?: string; // Returned in response
  enforce?: boolean;
  locale?: string;
}

/**
 * Cancellation details for canceled payments
 */
export interface YooKassaCancellationDetails {
  party: "merchant" | "yoo_money" | "payment_network";
  reason:
    | "3d_secure_failed"
    | "call_issuer"
    | "card_expired"
    | "fraud_suspected"
    | "general_decline"
    | "insufficient_funds"
    | "invalid_card_number"
    | "invalid_csc"
    | "issuer_unavailable"
    | "payment_method_limit_exceeded"
    | "payment_method_restricted"
    | "country_forbidden"
    | "permission_revoked"
    | "unsupported_mobile_operator"
    | "cancelled_by_merchant";
}

/**
 * Payment method information
 */
export interface YooKassaPaymentMethod {
  type: string; // e.g., "bank_card", "yoo_money", "sberbank", etc.
  id: string;
  saved: boolean;
  card?: {
    first6?: string;
    last4?: string;
    expiry_month?: string;
    expiry_year?: string;
    card_type?: string;
    issuer_country?: string;
    issuer_name?: string;
  };
  title?: string;
}

/**
 * Recipient information
 */
export interface YooKassaRecipient {
  account_id: string;
  gateway_id?: string;
}

/**
 * Payment status in YooKassa API
 * Note: For one-stage payments (capture: true), only pending, succeeded, and canceled are used
 */
export type YooKassaPaymentStatus =
  | "pending"
  | "succeeded"
  | "canceled";

/**
 * Request to create a payment in YooKassa
 */
export interface YooKassaCreatePaymentRequest {
  amount: YooKassaAmount;
  capture?: boolean; // true for one-stage payment, false for two-stage
  confirmation?: YooKassaConfirmation;
  description?: string; // Max 128 characters
  metadata?: Record<string, string>; // Max 16 keys, key max 32 chars, value max 512 chars
  payment_method_data?: {
    type: string;
    [key: string]: unknown;
  };
  payment_token?: string;
  payment_method_id?: string;
  receipt?: unknown; // Complex type, simplified for MVP
  recipient?: YooKassaRecipient;
  save_payment_method?: boolean;
  client_ip?: string;
}

/**
 * Response from YooKassa API when creating or retrieving a payment
 */
export interface YooKassaPaymentResponse {
  id: string; // YooKassa payment ID
  status: YooKassaPaymentStatus;
  paid: boolean;
  amount: YooKassaAmount;
  confirmation?: YooKassaConfirmation;
  created_at: string; // ISO 8601 format
  description?: string;
  expires_at?: string; // ISO 8601 format
  metadata?: Record<string, string>;
  payment_method?: YooKassaPaymentMethod;
  recipient?: YooKassaRecipient;
  refundable?: boolean;
  refunded_amount?: YooKassaAmount;
  captured_at?: string; // ISO 8601 format
  cancellation_details?: YooKassaCancellationDetails;
  test?: boolean;
  income_amount?: YooKassaAmount;
  authorization_details?: {
    rrn?: string;
    auth_code?: string;
    three_d_secure?: {
      applied: boolean;
    };
  };
}

/**
 * Webhook payload from YooKassa
 */
export interface YooKassaWebhookPayload {
  type: "notification";
  event: "payment.succeeded" | "payment.canceled";
  object: {
    id: string; // YooKassa payment ID (required)
    status: YooKassaPaymentStatus;
    paid: boolean;
    amount: YooKassaAmount;
    created_at: string;
    description?: string;
    metadata?: Record<string, string>;
    payment_method?: YooKassaPaymentMethod;
    cancellation_details?: YooKassaCancellationDetails;
    captured_at?: string;
    [key: string]: unknown; // Allow additional fields from YooKassa
  };
}

