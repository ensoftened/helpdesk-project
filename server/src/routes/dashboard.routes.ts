// Dashboard routes: admin-only, shows aggregated stats.

import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/authorize";
import { dashboard } from "../controllers/dashboard.controller";

const router = Router();
router.use(authenticate, requireAdmin);
router.get("/", dashboard);

export default router;
