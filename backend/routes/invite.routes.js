import express from "express";
import { inviteUser, acceptInvite, declineInvite, listProjectInvites } from "../controllers/invite.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, inviteUser);
router.post("/:inviteId/accept", authMiddleware, acceptInvite);
router.delete("/:inviteId", authMiddleware, declineInvite);
router.get("/project/:projectId", authMiddleware, listProjectInvites);

export default router;
