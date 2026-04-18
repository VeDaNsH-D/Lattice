import express from "express";
import { body, query } from "express-validator";

import {
    createLink,
    listDebateThreads,
    listLinks
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

export default router;
