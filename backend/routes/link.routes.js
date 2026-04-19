import express from "express";
import { body, param, query } from "express-validator";

import {
    createLink,
    deleteLink,
    listDebateThreads,
    listGraveyardLinks,
    listLinks,
    markLinkViewed,
    restoreLinkFromGraveyard,
    toggleLinkReaction
} from "../controllers/link.controller.js";
import {
    createLinkComment,
    listLinkComments,
    toggleLinkCommentResolution,
} from "../controllers/comment.controller.js";
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

router.get(
    "/graveyard",
    authMiddleware,
    listGraveyardLinks
);

router.delete(
    "/:id",
    authMiddleware,
    [param("id").isMongoId().withMessage("Valid link id is required")],
    validateRequest,
    deleteLink
);

router.post(
    "/:id/view",
    authMiddleware,
    [param("id").isMongoId().withMessage("Valid link id is required")],
    validateRequest,
    markLinkViewed
);

router.post(
    "/:id/restore",
    authMiddleware,
    [param("id").isMongoId().withMessage("Valid link id is required")],
    validateRequest,
    restoreLinkFromGraveyard
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

router.get(
    "/:id/comments",
    authMiddleware,
    [param("id").isMongoId().withMessage("Valid link id is required")],
    validateRequest,
    (req, res, next) => {
        req.params.linkId = req.params.id;
        return listLinkComments(req, res, next);
    }
);

router.post(
    "/:id/comments",
    authMiddleware,
    [
        param("id").isMongoId().withMessage("Valid link id is required"),
        body("text").optional().isString().withMessage("text must be a string"),
        body("gifUrl").optional().isString().withMessage("gifUrl must be a string"),
    ],
    validateRequest,
    (req, res, next) => {
        req.params.linkId = req.params.id;
        return createLinkComment(req, res, next);
    }
);

router.patch(
    "/:id/comments/:commentId/resolve",
    authMiddleware,
    [
        param("id").isMongoId().withMessage("Valid link id is required"),
        param("commentId").isMongoId().withMessage("Valid commentId is required"),
        body("resolved").optional().isBoolean().withMessage("resolved must be boolean"),
    ],
    validateRequest,
    toggleLinkCommentResolution
);

export default router;
