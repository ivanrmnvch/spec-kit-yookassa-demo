import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Zod schema for create payment request
 * Validates amount.value pattern and returnUrl format
 */
export const createPaymentRequestSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  amount: z.object({
    value: z.string().regex(/^[0-9]+\.[0-9]{2}$/, "amount.value must match pattern: ^[0-9]+\\.[0-9]{2}$"),
    currency: z.enum(["RUB"]),
  }),
  returnUrl: z.string().url("returnUrl must be a valid URL"),
  description: z.string().max(128, "description must be at most 128 characters").optional(),
  metadata: z.record(z.string()).optional(),
});

export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;

/**
 * Middleware to validate request body against Zod schema
 * @param schema - Zod schema to validate against
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      // Replace req.body with validated data
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map((err) => {
          const fieldPath = err.path.length > 0 ? err.path.join(".") : "root";
          return {
            path: fieldPath,
            message: err.message,
          };
        });
        
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details,
          },
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Middleware specifically for create payment request validation
 */
export const validateCreatePaymentRequest = validateRequest(createPaymentRequestSchema);

