import { PaymentStateMachine } from "../../src/services/payment-state-machine";

describe("PaymentStateMachine", () => {
  describe("allowed transitions", () => {
    it("should allow pending → succeeded", () => {
      const result = PaymentStateMachine.canTransition("pending", "succeeded");
      expect(result).toBe(true);
    });

    it("should allow pending → canceled", () => {
      const result = PaymentStateMachine.canTransition("pending", "canceled");
      expect(result).toBe(true);
    });
  });

  describe("disallowed transitions", () => {
    it("should disallow succeeded → pending", () => {
      const result = PaymentStateMachine.canTransition("succeeded", "pending");
      expect(result).toBe(false);
    });

    it("should disallow succeeded → canceled", () => {
      const result = PaymentStateMachine.canTransition("succeeded", "canceled");
      expect(result).toBe(false);
    });

    it("should disallow succeeded → succeeded", () => {
      const result = PaymentStateMachine.canTransition("succeeded", "succeeded");
      expect(result).toBe(false);
    });

    it("should disallow canceled → pending", () => {
      const result = PaymentStateMachine.canTransition("canceled", "pending");
      expect(result).toBe(false);
    });

    it("should disallow canceled → succeeded", () => {
      const result = PaymentStateMachine.canTransition("canceled", "succeeded");
      expect(result).toBe(false);
    });

    it("should disallow canceled → canceled", () => {
      const result = PaymentStateMachine.canTransition("canceled", "canceled");
      expect(result).toBe(false);
    });
  });

  describe("idempotent transitions", () => {
    it("should allow pending → pending (no-op)", () => {
      const result = PaymentStateMachine.canTransition("pending", "pending");
      expect(result).toBe(true);
    });

    it("should handle pending → pending transition as no-op", () => {
      const newStatus = PaymentStateMachine.transition("pending", "pending");
      expect(newStatus).toBe("pending");
    });
  });

  describe("transition method", () => {
    it("should return new status for allowed transition pending → succeeded", () => {
      const newStatus = PaymentStateMachine.transition("pending", "succeeded");
      expect(newStatus).toBe("succeeded");
    });

    it("should return new status for allowed transition pending → canceled", () => {
      const newStatus = PaymentStateMachine.transition("pending", "canceled");
      expect(newStatus).toBe("canceled");
    });

    it("should throw error for disallowed transition succeeded → pending", () => {
      expect(() => {
        PaymentStateMachine.transition("succeeded", "pending");
      }).toThrow();
    });

    it("should throw error for disallowed transition canceled → succeeded", () => {
      expect(() => {
        PaymentStateMachine.transition("canceled", "succeeded");
      }).toThrow();
    });

    it("should return same status for idempotent transition pending → pending", () => {
      const newStatus = PaymentStateMachine.transition("pending", "pending");
      expect(newStatus).toBe("pending");
    });
  });

  describe("final states immutability", () => {
    it("should recognize succeeded as final state", () => {
      const isFinal = PaymentStateMachine.isFinalState("succeeded");
      expect(isFinal).toBe(true);
    });

    it("should recognize canceled as final state", () => {
      const isFinal = PaymentStateMachine.isFinalState("canceled");
      expect(isFinal).toBe(true);
    });

    it("should recognize pending as non-final state", () => {
      const isFinal = PaymentStateMachine.isFinalState("pending");
      expect(isFinal).toBe(false);
    });
  });
});

