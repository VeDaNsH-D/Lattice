import { randomBytes } from "crypto";
import express from "express";
import mongoose from "mongoose";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import TelegramToken from "../models/telegramToken.js";
import User from "../models/user.js";
import Project from "../models/project.js";
import Link from "../models/link.js";
import { fetchMetadata } from "../services/metadata.service.js";
import { generateAIContent } from "../services/ai.service.js";

const router = express.Router();

const resolveTelegramUser = async (rawTelegramId) => {
    const telegramId = String(rawTelegramId || "").trim();

    if (!telegramId) {
        return { telegramId: "", user: null };
    }

    const user = await User.findOne({ telegramId });
    return { telegramId, user };
};

router.post("/generate-token", authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.userId;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user context",
            });
        }

        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + (10 * 60 * 1000));

        console.log("Generated token:", token);
        console.log("Saving for user:", userId);

        await TelegramToken.deleteMany({ userId });

        await TelegramToken.create({
            userId,
            token,
            expiresAt,
        });

        const saved = await TelegramToken.findOne({ token });
        console.log("Saved token in DB:", saved);

        return res.status(200).json({ token });
    } catch (error) {
        console.error("Failed to generate Telegram token:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to generate Telegram token",
        });
    }
});

router.post("/link", async (req, res) => {
    try {
        const token = typeof req.body?.token === "string" ? req.body.token : "";
        const cleanToken = token.trim();
        const telegramId = typeof req.body?.telegramId === "string"
            ? req.body.telegramId.trim()
            : String(req.body?.telegramId || "").trim();

        console.log("RAW TOKEN FROM BOT:", token);
        console.log("TRIMMED TOKEN:", cleanToken);

        if (!cleanToken || !telegramId) {
            return res.status(400).json({
                success: false,
                message: "token and telegramId are required",
            });
        }

        const allTokens = await TelegramToken.find({});
        console.log("ALL TOKENS IN DB:", allTokens);

        let tokenRecord = await TelegramToken.findOne({ token: cleanToken });

        if (!tokenRecord) {
            tokenRecord = await TelegramToken.findOne({
                token: { $regex: new RegExp(`^${cleanToken}$`, "i") },
            });
        }

        console.log("MATCHED RECORD:", tokenRecord);

        if (!tokenRecord) {
            return res.status(400).json({
                message: "Invalid token",
            });
        }

        // DEBUG ONLY: Expiry check temporarily disabled to isolate token matching issues.
        // if (tokenRecord.expiresAt < new Date()) {
        //     console.log("Token expired:", tokenRecord.expiresAt);
        //     await TelegramToken.deleteOne({ _id: tokenRecord._id });
        //     return res.status(400).json({
        //         message: "Token expired",
        //     });
        // }

        const user = await User.findByIdAndUpdate(tokenRecord.userId, {
            telegramId: telegramId,
        });

        if (!user) {
            await TelegramToken.deleteOne({ _id: tokenRecord._id });
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // DEBUG ONLY: One-time token deletion temporarily disabled while debugging matching.
        // await TelegramToken.deleteOne({ _id: tokenRecord._id });

        return res.json({
            success: true,
        });
    } catch (error) {
        console.error("Failed to link Telegram account:", error);

        if (error?.code === 11000 && error?.keyPattern?.telegramId) {
            return res.status(409).json({
                success: false,
                message: "This Telegram account is already linked",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to link Telegram account",
        });
    }
});

router.get("/me", async (req, res) => {
    try {
        const { telegramId, user } = await resolveTelegramUser(req.query?.telegramId);

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                message: "telegramId is required",
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Telegram account not linked",
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: String(user._id),
                name: user.name,
                email: user.email,
                telegramId: user.telegramId,
            },
        });
    } catch (error) {
        console.error("Failed to fetch Telegram user:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch Telegram user",
        });
    }
});

router.get("/lattices", async (req, res) => {
    try {
        const { telegramId, user } = await resolveTelegramUser(req.query?.telegramId);

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                message: "telegramId is required",
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Telegram account not linked",
            });
        }

        const lattices = await Project.find({
            isActive: true,
            $or: [
                { createdBy: user._id },
                { members: user._id },
            ],
        })
            .sort({ updatedAt: -1 })
            .select("name projectType createdBy")
            .lean();

        return res.status(200).json({
            success: true,
            lattices: lattices.map((lattice) => ({
                id: String(lattice._id),
                name: lattice.name,
                projectType: lattice.projectType,
            })),
        });
    } catch (error) {
        console.error("Failed to fetch Telegram lattices:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch lattices",
        });
    }
});

router.post("/add-link", async (req, res) => {
    try {
        const { telegramId, latticeId, url } = req.body || {};
        const cleanUrl = String(url || "").trim();
        const cleanLatticeId = String(latticeId || "").trim();

        if (!telegramId || !cleanLatticeId || !cleanUrl) {
            return res.status(400).json({
                success: false,
                message: "telegramId, latticeId and url are required",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(cleanLatticeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid latticeId",
            });
        }

        try {
            const parsed = new URL(cleanUrl);
            if (!["http:", "https:"].includes(parsed.protocol)) {
                throw new Error("unsupported protocol");
            }
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid URL",
            });
        }

        const { user } = await resolveTelegramUser(telegramId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Telegram account not linked",
            });
        }

        const lattice = await Project.findOne({
            _id: cleanLatticeId,
            isActive: true,
            $or: [
                { createdBy: user._id },
                { members: user._id },
            ],
        }).select("_id");

        if (!lattice) {
            return res.status(404).json({
                success: false,
                message: "Lattice not found",
            });
        }

        const metadata = await fetchMetadata(cleanUrl).catch(() => ({}));
        const resolvedTitle = metadata?.title || null;
        const resolvedDescription = metadata?.description || null;
        const resolvedImage = metadata?.image || null;

        const aiContent = await generateAIContent(resolvedTitle, resolvedDescription, cleanUrl)
            .catch(() => ({ summary: null, tags: [], vibe: null, parentHub: "General" }));

        const link = await Link.create({
            projectId: lattice._id,
            url: cleanUrl,
            title: resolvedTitle,
            description: resolvedDescription,
            image: resolvedImage,
            summary: aiContent.summary || null,
            tags: Array.isArray(aiContent.tags) ? aiContent.tags : [],
            vibe: aiContent.vibe || null,
            parentHub: aiContent.parentHub || "General",
            createdBy: user._id,
        });

        return res.status(201).json({
            success: true,
            link: {
                id: String(link._id),
                url: link.url,
                title: link.title,
            },
        });
    } catch (error) {
        console.error("Failed to add Telegram link:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to add link",
        });
    }
});

export default router;
