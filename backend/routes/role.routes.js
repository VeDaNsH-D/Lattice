import express from "express";
import { createRole, getProjectRoles } from "../controllers/role.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createRole);
router.get("/:projectId", authMiddleware, getProjectRoles);

export default router;
