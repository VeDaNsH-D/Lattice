import express from "express";
import { body, param } from "express-validator";

import {
    createLinkComment,
    listLinkComments,
    toggleLinkCommentResolution,
} from "../controllers/comment.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.get(
    "/links/:linkId",
    authMiddleware,
    [param("linkId").isMongoId().withMessage("Valid linkId is required")],
    validateRequest,
    listLinkComments
);

router.post(
    "/links/:linkId",
    authMiddleware,
    [
        param("linkId").isMongoId().withMessage("Valid linkId is required"),
        body("text").optional().isString().withMessage("text must be a string"),
        body("gifUrl").optional().isString().withMessage("gifUrl must be a string"),
    ],
    validateRequest,
    createLinkComment
);

router.patch(
    "/:commentId/resolve",
    authMiddleware,
    [
        param("commentId").isMongoId().withMessage("Valid commentId is required"),
        body("resolved").optional().isBoolean().withMessage("resolved must be boolean"),
    ],
    validateRequest,
    toggleLinkCommentResolution
);

export default router;