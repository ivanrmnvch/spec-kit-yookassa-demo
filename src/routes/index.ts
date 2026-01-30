import { Router } from "express";

import healthRoutes from "./health";
import paymentsRoutes from "./payments";
import webhooksRoutes from "./webhooks";

const router = Router();

// Mount health routes
router.use(healthRoutes);

// Mount API routes
router.use("/api/payments", paymentsRoutes);
router.use("/api/webhooks", webhooksRoutes);

export default router;

