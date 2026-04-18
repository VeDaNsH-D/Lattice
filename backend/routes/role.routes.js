import express from "express";
import { body, query } from "express-validator";

import { createRole, listRolesByProject } from "../controllers/role.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    [
        body("projectId").isMongoId().withMessage("Valid projectId is required"),
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Role name is required")
            .isLength({ min: 2, max: 60 })
            .withMessage("Role name must be between 2 and 60 characters"),
        body("permissions")
            .isIn(["full_access", "restricted_access", "view_only"])
            .withMessage("permissions must be full_access, restricted_access, or view_only")
    ],
    validateRequest,
    createRole
);

router.get(
    "/",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("Valid projectId is required")],
    validateRequest,
    listRolesByProject
);

export default router;
