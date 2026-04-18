import express from "express";
import { body } from "express-validator";

import { createProject, listProjects } from "../controllers/project.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, listProjects);

router.post(
    "/",
    authMiddleware,
    [
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Project name is required")
            .isLength({ min: 2, max: 80 })
            .withMessage("Project name must be between 2 and 80 characters"),
        body("projectType")
            .isIn(["personal", "collaborative"])
            .withMessage("projectType must be either personal or collaborative"),
    ],
    validateRequest,
    createProject
);

export default router;
