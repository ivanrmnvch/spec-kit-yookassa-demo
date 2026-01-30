import { PaymentStatus } from "../types/payment.types";

/**
 * Payment state machine
 *
 * Enforces the payment state transition rules per data-model.md:
 * - Allowed transitions: pending → succeeded, pending → canceled
 * - Disallowed transitions: succeeded → *, canceled → * (final states are immutable)
 * - Idempotent transitions: X → X is allowed for non-final states (no-op)
 *
 * Final states (succeeded, canceled) cannot transition to any state, including themselves.
 */
export class PaymentStateMachine {
  private static readonly FINAL_STATES: readonly PaymentStatus[] = [
    "succeeded",
    "canceled",
  ] as const;

  /**
   * Check if a transition from currentStatus to newStatus is allowed
   *
   * @param currentStatus - Current payment status
   * @param newStatus - Desired new payment status
   * @returns true if transition is allowed, false otherwise
   */
  static canTransition(
    currentStatus: PaymentStatus,
    newStatus: PaymentStatus
  ): boolean {
    // Final states are immutable: cannot transition to any state
    if (this.isFinalState(currentStatus)) {
      return false;
    }

    // Idempotent transition: same status is allowed for non-final states (no-op)
    if (currentStatus === newStatus) {
      return true;
    }

    // From pending, only succeeded and canceled are allowed
    if (currentStatus === "pending") {
      return newStatus === "succeeded" || newStatus === "canceled";
    }

    // All other transitions are disallowed
    return false;
  }

  /**
   * Perform a state transition
   *
   * @param currentStatus - Current payment status
   * @param newStatus - Desired new payment status
   * @returns The new status (same as newStatus for allowed transitions)
   * @throws Error if transition is not allowed
   */
  static transition(
    currentStatus: PaymentStatus,
    newStatus: PaymentStatus
  ): PaymentStatus {
    if (!this.canTransition(currentStatus, newStatus)) {
      throw new Error(
        `Invalid state transition: ${currentStatus} → ${newStatus}. ` +
          `Final states (succeeded, canceled) are immutable and cannot be changed.`
      );
    }

    return newStatus;
  }

  /**
   * Check if a status is a final state (immutable)
   *
   * @param status - Payment status to check
   * @returns true if status is final (succeeded or canceled), false otherwise
   */
  static isFinalState(status: PaymentStatus): boolean {
    return this.FINAL_STATES.includes(status as typeof this.FINAL_STATES[number]);
  }
}

