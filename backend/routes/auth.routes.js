import express from "express";
import { body } from "express-validator";
import passport from "passport";
import {
    getCurrentUser,
    loginUser,
    registerUser
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import generateToken from "../utils/generateToken.js";

const router = express.Router();

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

const normalizeFrontendOrigin = (candidate) => {
    if (!candidate) {
        return frontendUrl;
    }

    try {
        const parsed = new URL(candidate);
        const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

        if (!isLocalhost) {
            return frontendUrl;
        }

        return parsed.origin;
    } catch {
        return frontendUrl;
    }
};

const buildFrontendRedirect = (path, params = {}, baseUrl = frontendUrl) => {
    const url = new URL(path, baseUrl);

    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
};

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

router.get(
    "/google",
    (req, res, next) => {
        const state = normalizeFrontendOrigin(req.query.frontend);

        return passport.authenticate("google", {
            scope: ["profile", "email"],
            session: false,
            state,
        })(req, res, next);
    }
);

router.get(
    "/google/callback",
    (req, res, next) => {
        const callbackFrontend = normalizeFrontendOrigin(req.query.state);

        return passport.authenticate("google", {
            failureRedirect: buildFrontendRedirect("/login", { error: "google_auth_failed" }, callbackFrontend),
            session: false,
        })(req, res, next);
    },
    (req, res) => {
        const callbackFrontend = normalizeFrontendOrigin(req.query.state);
        const token = generateToken(req.user._id);

        return res.redirect(buildFrontendRedirect("/login", { token }, callbackFrontend));
    }
);

export default router;
