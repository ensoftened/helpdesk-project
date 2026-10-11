// Admin routes: all require authenticate + requireAdmin middleware.
// Handles User, Team, Category, Priority, and SLA CRUD.

import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import * as ctrl from "../controllers/admin.controller";
import {
  createUserSchema, updateUserSchema, resetPasswordSchema,
  createTeamSchema, updateTeamSchema,
  createCategorySchema, updateCategorySchema,
  createPrioritySchema, updatePrioritySchema,
  createSLASchema, updateSLASchema,
} from "../validators/admin.validator";

const router = Router();
router.use(authenticate, requireAdmin);

// Users
router.get("/users", ctrl.listUsers);
router.get("/users/:id", ctrl.getUser);
router.post("/users", validate(createUserSchema), ctrl.createUser);
router.patch("/users/:id", validate(updateUserSchema), ctrl.updateUser);
router.post("/users/:id/reset-password", validate(resetPasswordSchema), ctrl.resetPassword);

// Teams
router.get("/teams", ctrl.listTeams);
router.get("/teams/:id", ctrl.getTeam);
router.post("/teams", validate(createTeamSchema), ctrl.createTeam);
router.patch("/teams/:id", validate(updateTeamSchema), ctrl.updateTeam);
router.delete("/teams/:id", ctrl.deleteTeam);

// Categories
router.get("/categories", ctrl.listCategories);
router.get("/categories/:id", ctrl.getCategory);
router.post("/categories", validate(createCategorySchema), ctrl.createCategory);
router.patch("/categories/:id", validate(updateCategorySchema), ctrl.updateCategory);
router.delete("/categories/:id", ctrl.deleteCategory);

// Priorities
router.get("/priorities", ctrl.listPriorities);
router.get("/priorities/:id", ctrl.getPriority);
router.post("/priorities", validate(createPrioritySchema), ctrl.createPriority);
router.patch("/priorities/:id", validate(updatePrioritySchema), ctrl.updatePriority);
router.delete("/priorities/:id", ctrl.deletePriority);

// SLA rules
router.get("/slas", ctrl.listSLAs);
router.get("/slas/:id", ctrl.getSLA);
router.post("/slas", validate(createSLASchema), ctrl.createSLA);
router.patch("/slas/:id", validate(updateSLASchema), ctrl.updateSLA);
router.delete("/slas/:id", ctrl.deleteSLA);

export default router;
