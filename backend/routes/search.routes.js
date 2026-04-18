import express from "express";
import { searchLinks } from "../controllers/search.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, searchLinks);

export default router;
