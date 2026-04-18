import Project from "../models/project.js";
import User from "../models/user.js";
import { normalizeProject } from "./project.controller.js";

export const getUserProfile = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const lattices = await Project.find({
            createdBy: userId,
            isActive: true,
            isPublic: true,
        })
            .sort({ updatedAt: -1 })
            .populate("createdBy", "name email")
            .lean();

        return res.status(200).json({
            success: true,
            user: {
                _id: String(user._id),
                name: user.name,
                bio: user.bio || "",
                avatar: user.avatarUrl || null,
                linkedinUrl: user.linkedinUrl || "",
                githubUrl: user.githubUrl || "",
                websiteUrl: user.websiteUrl || "",
                xUrl: user.xUrl || "",
                linkDecayStartDays: Number.isFinite(user.linkDecayStartDays) ? user.linkDecayStartDays : 14,
                linkGraveyardDays: Number.isFinite(user.linkGraveyardDays) ? user.linkGraveyardDays : 30,
            },
            lattices: lattices.map((project) => normalizeProject(project)),
        });
    } catch (error) {
        return next(error);
    }
};

export const updateCurrentUserProfile = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const {
            name,
            bio,
            avatar,
            avatarUrl,
            linkedinUrl,
            githubUrl,
            websiteUrl,
            xUrl,
            linkDecayStartDays,
            linkGraveyardDays,
        } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (typeof name === "string") {
            const trimmedName = name.trim();
            if (trimmedName) {
                user.name = trimmedName;
            }
        }

        if (typeof bio === "string") {
            user.bio = bio.trim();
        }

        const nextAvatar = typeof avatar === "string" ? avatar.trim() : typeof avatarUrl === "string" ? avatarUrl.trim() : "";
        if (nextAvatar) {
            user.avatarUrl = nextAvatar;
        }

        if (typeof linkedinUrl === "string") {
            user.linkedinUrl = linkedinUrl.trim();
        }

        if (typeof githubUrl === "string") {
            user.githubUrl = githubUrl.trim();
        }

        if (typeof websiteUrl === "string") {
            user.websiteUrl = websiteUrl.trim();
        }

        if (typeof xUrl === "string") {
            user.xUrl = xUrl.trim();
        }

        const nextDecayStart = Number.isFinite(Number(linkDecayStartDays))
            ? Number(linkDecayStartDays)
            : user.linkDecayStartDays;
        const nextGraveyardDays = Number.isFinite(Number(linkGraveyardDays))
            ? Number(linkGraveyardDays)
            : user.linkGraveyardDays;

        if (nextGraveyardDays <= nextDecayStart) {
            return res.status(400).json({
                success: false,
                message: "Graveyard days must be greater than decay start days",
            });
        }

        if (Number.isFinite(Number(linkDecayStartDays))) {
            user.linkDecayStartDays = nextDecayStart;
        }

        if (Number.isFinite(Number(linkGraveyardDays))) {
            user.linkGraveyardDays = nextGraveyardDays;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                bio: user.bio || "",
                avatar: user.avatarUrl || null,
                linkedinUrl: user.linkedinUrl || "",
                githubUrl: user.githubUrl || "",
                websiteUrl: user.websiteUrl || "",
                xUrl: user.xUrl || "",
                linkDecayStartDays: Number.isFinite(user.linkDecayStartDays) ? user.linkDecayStartDays : 14,
                linkGraveyardDays: Number.isFinite(user.linkGraveyardDays) ? user.linkGraveyardDays : 30,
            },
        });
    } catch (error) {
        return next(error);
    }
};