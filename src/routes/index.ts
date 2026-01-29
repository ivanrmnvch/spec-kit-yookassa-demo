import { Router } from "express";

import healthRoutes from "./health";
import paymentsRoutes from "./payments";

const router = Router();

// Mount health routes
router.use(healthRoutes);

// Mount API routes
router.use("/api/payments", paymentsRoutes);

export default router;

