import Project from "../models/project.js";
import Link from "../models/link.js";
import User from "../models/user.js";
import { normalizeProject } from "./project.controller.js";
import { normalizeVibe } from "../utils/vibe.js";

const VIBE_ROLE_LABELS = {
    "high-signal": "Curator",
    educational: "Guide",
    motivational: "Aspirer",
    chaotic: "Storm Chaser",
    cursed: "Reclaimer",
    general: "Explorer",
};

const VIBE_TIE_BREAK_ORDER = [
    "high-signal",
    "educational",
    "motivational",
    "chaotic",
    "cursed",
    "general",
];

const buildProfileRole = (vibes = []) => {
    const counts = new Map();

    for (const vibe of vibes) {
        const key = normalizeVibe(vibe || "general", "general") || "general";
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    if (counts.size === 0) {
        return {
            vibe: "general",
            label: VIBE_ROLE_LABELS.general,
            summary: "Dominant bookmark vibe: general",
            totalBookmarks: 0,
            counts: {},
        };
    }

    let dominantVibe = "general";
    let dominantCount = 0;

    for (const vibe of VIBE_TIE_BREAK_ORDER) {
        const count = counts.get(vibe) || 0;
        if (count > dominantCount) {
            dominantVibe = vibe;
            dominantCount = count;
        }
    }

    const totalBookmarks = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
    const share = totalBookmarks > 0 ? dominantCount / totalBookmarks : 0;

    return {
        vibe: dominantVibe,
        label: VIBE_ROLE_LABELS[dominantVibe] || VIBE_ROLE_LABELS.general,
        summary: `Dominant bookmark vibe: ${dominantVibe}`,
        totalBookmarks,
        share: Number(share.toFixed(2)),
        counts: Object.fromEntries(counts.entries()),
    };
};

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
        })
            .sort({ updatedAt: -1 })
            .populate("createdBy", "name email")
            .lean();

        const latticeIds = lattices.map((project) => project._id).filter(Boolean);
        const bookmarks = latticeIds.length > 0
            ? await Link.find({
                projectId: { $in: latticeIds },
                deletedAt: null,
            })
                .select("vibe projectId")
                .lean()
            : [];

        const profileRole = buildProfileRole(bookmarks.map((bookmark) => bookmark.vibe));

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
                roleLabel: profileRole.label,
                roleVibe: profileRole.vibe,
                roleSummary: profileRole.summary,
                roleShare: profileRole.share,
                roleCounts: profileRole.counts,
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