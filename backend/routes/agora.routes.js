import express from "express";
import AgoraTokenPkg from "agora-token";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import Project from "../models/project.js";

const { RtcTokenBuilder, RtcRole } = AgoraTokenPkg;

const router = express.Router();

// Helper to check if user has project access
const canAccessProject = async (userId, projectId) => {
    return Project.exists({
        _id: projectId,
        isActive: true,
        $or: [{ createdBy: userId }, { members: userId }],
    });
};

/**
 * POST /api/agora/token
 * Generate a fresh RTC token for joining a call
 * Body: { projectId, role?: 'publisher' | 'subscriber' }
 */
router.post("/token", authMiddleware, async (req, res) => {
    try {
        const { projectId, role = "publisher" } = req.body;
        const userId = req.user.userId;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: "projectId is required",
            });
        }

        // Verify user has access to this project
        const hasAccess = await canAccessProject(userId, projectId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this project",
            });
        }

        // Get Agora credentials from environment
        const appId = process.env.AGORA_APP_ID?.trim();
        const appCertificate =
            process.env.AGORA_APP_CERTIFICATE?.trim()
            || process.env.AGORA_CHANNEL_CERTIFICATE?.trim();

        if (!appId) {
            return res.status(500).json({
                success: false,
                message: "Agora app ID not configured",
            });
        }

        // Keep channel naming aligned with frontend ProjectRealtimePanel.
        const channelPrefix = process.env.AGORA_CHANNEL_PREFIX?.trim() || "lattice";
        const channel = `${channelPrefix}-${String(projectId || "room")}`;

        // Use user ID as the Agora UID (ensure it's a number)
        // Extract numeric part or hash the userId to get a number
        let uid = parseInt(userId.substring(0, 8), 36) % 2147483647;
        if (uid < 0) uid = Math.abs(uid);
        if (uid === 0) uid = 1; // Agora doesn't accept 0 as UID

        // Token expiration: 1 hour (3600 seconds)
        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        let token;

        if (!appCertificate) {
            return res.status(500).json({
                success: false,
                message: "Agora certificate not configured",
                hint: "Set AGORA_APP_CERTIFICATE (or AGORA_CHANNEL_CERTIFICATE) in backend env.",
            });
        }

        token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channel,
            uid,
            role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
            privilegeExpiredTs
        );

        return res.json({
            success: true,
            token,
            uid,
            appId,
            channel,
            expiresIn: expirationTimeInSeconds,
        });
    } catch (error) {
        console.error("Error generating Agora token:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate token",
            error: error.message,
        });
    }
});

export default router;
