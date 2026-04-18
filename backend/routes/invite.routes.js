import express from "express";
import { inviteUser, acceptInvite, rejectInvite, listProjectInvites } from "../controllers/invite.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, inviteUser);
router.post("/:id/accept", authMiddleware, acceptInvite);
router.post("/:id/reject", authMiddleware, rejectInvite);
router.get("/project/:projectId", authMiddleware, listProjectInvites);

export default router;
