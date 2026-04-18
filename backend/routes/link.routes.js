import express from "express";
import { body, param, query } from "express-validator";

import {
    createLink,
    deleteLink,
    listDebateThreads,
    listLinks,
    toggleLinkReaction
} from "../controllers/link.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    [
        body("projectId").isMongoId().withMessage("Valid projectId is required"),
        body("url").isURL().withMessage("Valid url is required"),
        body("accessType")
            .optional()
            .isIn(["public", "role_based"])
            .withMessage("accessType must be public or role_based"),
        body("allowedRoles")
            .optional()
            .isArray()
            .withMessage("allowedRoles must be an array"),
        body("allowedRoles.*")
            .optional()
            .isMongoId()
            .withMessage("Each role id in allowedRoles must be valid")
    ],
    validateRequest,
    createLink
);

router.get(
    "/",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("Valid projectId is required")],
    validateRequest,
    listLinks
);

router.get(
    "/debates",
    authMiddleware,
    [query("projectId").isMongoId().withMessage("Valid projectId is required")],
    validateRequest,
    listDebateThreads
);

router.delete(
    "/:id",
    authMiddleware,
    [param("id").isMongoId().withMessage("Valid link id is required")],
    validateRequest,
    deleteLink
);

router.post(
    "/:id/reactions",
    authMiddleware,
    [
        param("id").isMongoId().withMessage("Valid link id is required"),
        body("emoji").trim().notEmpty().withMessage("emoji is required")
    ],
    validateRequest,
    toggleLinkReaction
);

export default router;
