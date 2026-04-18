import express from "express";
import { param } from "express-validator";

import { listNotifications, markNotificationAsRead } from "../controllers/notification.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, listNotifications);

router.patch(
    "/:id/read",
    authMiddleware,
    [param("id").isMongoId().withMessage("Valid notification id is required")],
    validateRequest,
    markNotificationAsRead
);

export default router;
