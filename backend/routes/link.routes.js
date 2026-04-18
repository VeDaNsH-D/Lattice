import express from "express";
import { body, query } from "express-validator";
import {
    createLink,
    listDebateThreads,
    listLinks
} from "../controllers/link.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission, requireProjectMember } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    [
        body("projectId").isMongoId().withMessage("projectId must be a valid id"),
        body("url").trim().isURL().withMessage("url must be valid"),
        body("title").optional().isString(),
        body("description").optional().isString(),
        body("image").optional().isURL().withMessage("image must be valid url"),
        body("tags").optional().isArray(),
        body("vibe").optional().isString(),
        body("accessType").optional().isIn(["public", "role_based"]),
        body("allowedRoles").optional().isArray()
    ],
    validateRequest,
    requireProjectMember,
    requirePermission("full_access", "restricted_access"),
    createLink
);

router.get(
    "/",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("projectId must be a valid id")],
    validateRequest,
    requireProjectMember,
    listLinks
);

router.get(
    "/debates",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("projectId must be a valid id")],
    validateRequest,
    requireProjectMember,
    listDebateThreads
);

export default router;
