/**
 * Domain types for payment entities
 */

/**
 * Payment status in the domain model
 * Matches the state machine: pending → succeeded|canceled
 */
export type PaymentStatus = "pending" | "succeeded" | "canceled";

/**
 * Cancellation details for canceled payments
 */
export interface CancellationDetails {
  party: string;
  reason: string;
}

/**
 * Payment amount with currency
 */
export interface PaymentAmount {
  value: string; // Decimal string with 2 decimal places, e.g., "100.00"
  currency: "RUB";
}

