import express from "express";
import { body, param } from "express-validator";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getUserProfile, updateCurrentUserProfile } from "../controllers/user.controller.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.get(
    "/:userId",
    [param("userId").isMongoId().withMessage("Valid user id is required")],
    validateRequest,
    getUserProfile
);

router.patch(
    "/me",
    authMiddleware,
    [
        body("name").optional().isString().withMessage("name must be a string"),
        body("bio").optional().isString().withMessage("bio must be a string"),
        body("avatar").optional().isURL({ require_protocol: true }).withMessage("avatar must be a valid URL"),
        body("avatarUrl").optional().isURL({ require_protocol: true }).withMessage("avatarUrl must be a valid URL"),
        body("linkedinUrl").optional().isURL({ require_protocol: true }).withMessage("linkedinUrl must be a valid URL"),
        body("githubUrl").optional().isURL({ require_protocol: true }).withMessage("githubUrl must be a valid URL"),
        body("websiteUrl").optional().isURL({ require_protocol: true }).withMessage("websiteUrl must be a valid URL"),
        body("xUrl").optional().isURL({ require_protocol: true }).withMessage("xUrl must be a valid URL"),
        body("linkDecayStartDays").optional().isInt({ min: 1, max: 365 }).withMessage("linkDecayStartDays must be between 1 and 365"),
        body("linkGraveyardDays").optional().isInt({ min: 2, max: 730 }).withMessage("linkGraveyardDays must be between 2 and 730"),
    ],
    validateRequest,
    updateCurrentUserProfile
);

export default router;