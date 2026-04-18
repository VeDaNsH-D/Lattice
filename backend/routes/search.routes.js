import express from "express";
import { searchLinks, searchSpotlight } from "../controllers/search.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/spotlight", authMiddleware, searchSpotlight);
router.get("/", authMiddleware, searchLinks);

export default router;
