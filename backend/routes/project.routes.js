import express from "express";
import { createProject } from "../controllers/project.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createProject);

export default router;
