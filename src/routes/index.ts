import { Router } from "express";

import healthRoutes from "./health";

const router = Router();

// Mount health routes
router.use(healthRoutes);

export default router;

