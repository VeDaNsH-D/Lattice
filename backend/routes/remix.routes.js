import express from "express";
import { body, param, query } from "express-validator";

import {
    forkProject,
    getProjectLineage,
    getForkActivity,
    listPublicProjects,
    updateProjectVisibility,
} from "../controllers/remix.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.get(
    "/projects/public",
    [query("search").optional().isString().withMessage("search must be a string")],
    validateRequest,
    listPublicProjects
);

router.patch(
    "/projects/:projectId/visibility",
    authMiddleware,
    [
        param("projectId").isMongoId().withMessage("Valid projectId is required"),
        body("isPublic").isBoolean().withMessage("isPublic must be boolean"),
    ],
    validateRequest,
    updateProjectVisibility
);

router.post(
    "/projects/:projectId/fork",
    authMiddleware,
    [
        param("projectId").isMongoId().withMessage("Valid projectId is required"),
        body("name").optional().isString().withMessage("name must be a string"),
    ],
    validateRequest,
    forkProject
);

router.get(
    "/projects/:projectId/lineage",
    authMiddleware,
    [param("projectId").isMongoId().withMessage("Valid projectId is required")],
    validateRequest,
    getProjectLineage
);

router.get(
    "/activity",
    authMiddleware,
    getForkActivity
);

export default router;