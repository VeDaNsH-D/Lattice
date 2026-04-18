import express from "express";
import { body, query } from "express-validator";
import {
    downloadLatestProjectPulse,
    getLatestProjectPulse,
    listProjectPulses,
    runDailyPulseNow
} from "../controllers/pulse.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission, requireProjectMember } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.post(
    "/run",
    authMiddleware,
    [body("projectId").isMongoId().withMessage("projectId must be a valid id")],
    validateRequest,
    requireProjectMember,
    requirePermission("full_access", "restricted_access"),
    runDailyPulseNow
);

router.get(
    "/latest",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("projectId must be a valid id")],
    validateRequest,
    requireProjectMember,
    getLatestProjectPulse
);

router.get(
    "/history",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("projectId must be a valid id")],
    validateRequest,
    requireProjectMember,
    listProjectPulses
);

router.get(
    "/download",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("projectId must be a valid id")],
    validateRequest,
    requireProjectMember,
    downloadLatestProjectPulse
);

export default router;
