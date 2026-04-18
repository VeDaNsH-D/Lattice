import express from "express";

import { importBookmarks } from "../controllers/bookmarks.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/import", authMiddleware, importBookmarks);

export default router;
