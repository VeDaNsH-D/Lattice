import express from "express";
import { query } from "express-validator";

import { listRolesByProject } from "../controllers/role.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("Valid projectId is required")],
    validateRequest,
    listRolesByProject
);

export default router;
