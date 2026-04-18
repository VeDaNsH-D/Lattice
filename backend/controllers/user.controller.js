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
        const { name, bio, avatar, avatarUrl } = req.body;

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

        await user.save();

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                bio: user.bio || "",
                avatar: user.avatarUrl || null,
            },
        });
    } catch (error) {
        return next(error);
    }
};