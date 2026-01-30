import { Router } from "express";

import healthRoutes from "./health";

const router = Router();

// Mount health routes
router.use(healthRoutes);

// Note: payments and webhooks routes are mounted directly in app.ts
// because they require controller instances to be created first

export default router;

