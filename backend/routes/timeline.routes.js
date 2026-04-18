import express from "express";
import {
    createSnapshotController,
    getHistoryController,
    getTimelineController,
} from "../controllers/timeline.controller.js";

const router = express.Router();

// Trigger a new snapshot for the hardcoded mock link.
router.post("/snapshot", createSnapshotController);

// Return compressed timeline (minor/major events only).
router.get("/timeline", getTimelineController);

// Return complete snapshot history for the mock link.
router.get("/history", getHistoryController);

export default router;
