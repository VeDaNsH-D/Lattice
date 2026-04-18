import express from "express";
import { body } from "express-validator";
import {
    getCurrentUser,
    loginUser,
    registerUser
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.post(
    "/register",
    [
        body("name").trim().notEmpty().withMessage("name is required"),
        body("email").trim().isEmail().withMessage("valid email is required"),
        body("password")
            .isLength({ min: 6 })
            .withMessage("password must be at least 6 characters")
    ],
    validateRequest,
    registerUser
);

router.post(
    "/signup",
    [
        body("name").trim().notEmpty().withMessage("name is required"),
        body("email").trim().isEmail().withMessage("valid email is required"),
        body("password")
            .isLength({ min: 6 })
            .withMessage("password must be at least 6 characters")
    ],
    validateRequest,
    registerUser
);

router.post(
    "/login",
    [
        body("email").trim().isEmail().withMessage("valid email is required"),
        body("password").notEmpty().withMessage("password is required")
    ],
    validateRequest,
    loginUser
);

router.get("/me", authMiddleware, getCurrentUser);

export default router;
