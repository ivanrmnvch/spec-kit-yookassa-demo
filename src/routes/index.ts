import { Router } from "express";

const router = Router();

// Temporary health route - will be moved to src/routes/health.ts in T020
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default router;

