import Link from "../models/link.js";
import Comment from "../models/comment.js";
import Message from "../models/message.js";
import Project from "../models/project.js";
import Room from "../models/room.js";
import User from "../models/user.js";
import { fetchMetadata } from "../services/metadata.service.js";
import { generateAIContent } from "../services/ai.service.js";
import { ensureLinkEnrichment, processNewLinkForCollision } from "../services/link-intelligence.service.js";
import { buildGraphNode } from "../services/graph.service.js";
import { publishDecayTelemetry } from "../services/realtime-synapse.service.js";
import { recordActivity } from "../services/activityLog.service.js";
import { resolveVibe } from "../utils/vibe.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DECAY_START_DAYS = 14;
const DEFAULT_COMPOST_DAYS = 30;

const resolveDecaySettings = (userDoc) => {
    const decayStartDays = Number.isFinite(Number(userDoc?.linkDecayStartDays))
        ? Number(userDoc.linkDecayStartDays)
        : DEFAULT_DECAY_START_DAYS;
    const graveyardDaysRaw = Number.isFinite(Number(userDoc?.linkGraveyardDays))
        ? Number(userDoc.linkGraveyardDays)
        : DEFAULT_COMPOST_DAYS;
    const graveyardDays = graveyardDaysRaw > decayStartDays
        ? graveyardDaysRaw
        : decayStartDays + 1;

    return {
        decayStartDays,
        graveyardDays,
    };
};

const toLinkWithAgingMeta = (linkDoc, settings = resolveDecaySettings(null)) => {
    const link = linkDoc?.toObject ? linkDoc.toObject() : linkDoc;
    const lastViewedAt = link.lastClickedAt || link.createdAt;
    const lastTouchedAt = new Date(lastViewedAt || Date.now());
    const inactiveDays = Math.max(0, Math.floor((Date.now() - lastTouchedAt.getTime()) / DAY_IN_MS));

    const isDecayWindow = inactiveDays >= settings.decayStartDays && inactiveDays < settings.graveyardDays;
    const decayProgress = isDecayWindow
        ? (inactiveDays - settings.decayStartDays) / (settings.graveyardDays - settings.decayStartDays)
        : 0;

    return {
        ...link,
        lastViewedAt,
        lastModifiedAt: link.updatedAt,
        inactiveDays,
        isDecayWindow,
        decayProgress: Number(decayProgress.toFixed(3)),
        decayStartDays: settings.decayStartDays,
        graveyardDays: settings.graveyardDays,
    };
};

const getLinkCreatorId = (linkDoc) => String(linkDoc?.createdBy?._id || linkDoc?.createdBy || "");

const resolveSettingsForLink = (linkDoc, agingContext) => {
    if (!agingContext) {
        return resolveDecaySettings(null);
    }

    const creatorId = getLinkCreatorId(linkDoc);
    return agingContext.settingsByCreatorId.get(creatorId) || agingContext.defaultSettings;
};

const updateAgingStatusesForProjects = async (projectIds, userId) => {
    const currentUser = userId ? await User.findById(userId).select("linkDecayStartDays linkGraveyardDays") : null;
    const defaultSettings = resolveDecaySettings(currentUser);

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
        return {
            defaultSettings,
            settingsByCreatorId: new Map(),
        };
    }

    const now = Date.now();

    const links = await Link.find({
        projectId: { $in: projectIds },
    }).select("_id projectId createdBy status lastClickedAt createdAt movedToCompostAt graveyardReason deletedAt");

    const creatorIds = Array.from(new Set(
        links.map((link) => getLinkCreatorId(link)).filter(Boolean)
    ));

    const creatorDocs = creatorIds.length > 0
        ? await User.find({ _id: { $in: creatorIds } }).select("linkDecayStartDays linkGraveyardDays")
        : [];

    const settingsByCreatorId = new Map(
        creatorDocs.map((doc) => [String(doc._id), resolveDecaySettings(doc)])
    );

    const telemetrySignals = [];

    const updates = links
        .map((link) => {
            const settings = resolveSettingsForLink(link, {
                defaultSettings,
                settingsByCreatorId,
            });
            const lastTouchedAt = new Date(link.lastClickedAt || link.createdAt || Date.now());
            const inactiveDays = Math.max(0, Math.floor((now - lastTouchedAt.getTime()) / DAY_IN_MS));

            if (link.status === "dead" && link.graveyardReason === "deleted") {
                return null;
            }

            if (inactiveDays >= settings.graveyardDays) {
                if (link.status !== "dead" || link.graveyardReason !== "expired") {
                    telemetrySignals.push({
                        projectId: String(link.projectId),
                        linkId: String(link._id),
                        status: "dead",
                        reason: "expired",
                        trigger: "aging",
                        userId,
                    });

                    return {
                        updateOne: {
                            filter: { _id: link._id },
                            update: {
                                $set: {
                                    status: "dead",
                                    movedToCompostAt: new Date(),
                                    graveyardReason: "expired",
                                },
                            },
                        },
                    };
                }

                return null;
            }

            if (inactiveDays >= settings.decayStartDays) {
                if (link.status !== "decaying") {
                    telemetrySignals.push({
                        projectId: String(link.projectId),
                        linkId: String(link._id),
                        status: "decaying",
                        reason: "inactivity_window",
                        trigger: "aging",
                        userId,
                    });

                    return {
                        updateOne: {
                            filter: { _id: link._id },
                            update: {
                                $set: {
                                    status: "decaying",
                                },
                                $unset: {
                                    movedToCompostAt: 1,
                                },
                            },
                        },
                    };
                }

                return null;
            }

            if (link.status !== "active") {
                telemetrySignals.push({
                    projectId: String(link.projectId),
                    linkId: String(link._id),
                    status: "active",
                    reason: "revived_by_activity",
                    trigger: "aging",
                    userId,
                });

                return {
                    updateOne: {
                        filter: { _id: link._id },
                        update: {
                            $set: {
                                status: "active",
                                graveyardReason: null,
                            },
                            $unset: {
                                movedToCompostAt: 1,
                            },
                        },
                    },
                };
            }

            return null;
        })
        .filter(Boolean);

    if (updates.length > 0) {
        await Link.bulkWrite(updates);

        telemetrySignals.forEach((signal) => {
            void publishDecayTelemetry(signal);
        });
    }

    return {
        defaultSettings,
        settingsByCreatorId,
    };
};

export const createLink = async (req, res, next) => {
    try {
        const {
            projectId,
            url,
            title,
            description,
            image,
            deadline,
            tags,
            vibe,
            accessType,
            allowedRoles
        } = req.body;

        const metadata = await fetchMetadata(url);
        const resolvedTitle = title ?? metadata.title ?? null;
        const resolvedDescription = description ?? metadata.description ?? null;
        const resolvedImage = image ?? metadata.image ?? null;
        const resolvedDeadline = deadline ? new Date(deadline) : null;
        const normalizedDeadline =
            resolvedDeadline && !Number.isNaN(resolvedDeadline.getTime())
                ? resolvedDeadline
                : null;

        // Generate AI content (tags, vibe, parent hub) if not provided
        let aiContent = { summary: null, tags: [], vibe: null, parentHub: "General" };
        if (!tags || tags.length === 0 || !vibe || !req.body.parentHub) {
            aiContent = await generateAIContent(resolvedTitle, resolvedDescription, url);
        }

        const finalTags = tags && tags.length > 0 ? tags : aiContent.tags;
        const finalParentHub = req.body.parentHub || aiContent.parentHub || "General";
        const finalVibe = resolveVibe(vibe || aiContent.vibe, {
            title: resolvedTitle,
            description: resolvedDescription,
            url,
            tags: finalTags,
            parentHub: finalParentHub
        });

        const link = await Link.create({
            projectId,
            url,
            title: resolvedTitle,
            description: resolvedDescription,
            image: resolvedImage,
            tags: finalTags,
            vibe: finalVibe,
            parentHub: finalParentHub,
            deadline: normalizedDeadline,
            accessType,
            allowedRoles,
            createdBy: req.user.userId
        });

        const enrichedLink = await Link.findById(link._id);

        await recordActivity({
            projectId,
            actorId: req.user.userId,
            type: "link_added",
            payload: {
                linkId: String(link._id),
                title: resolvedTitle || url,
                url,
            },
        });

        setImmediate(() => {
            Promise.resolve()
                .then(() => ensureLinkEnrichment(link))
                .then(() => processNewLinkForCollision(link))
                .then(() => buildGraphNode({
                    _id: link._id,
                    sourceId: String(link._id),
                    sourceType: "link",
                    title: link.title || link.url,
                    summary: link.summary || link.description || "",
                    tags: link.tags || [],
                    embedding: link.embedding,
                    latticeId: link.projectId,
                    parentHub: link.parentHub || finalParentHub,
                }))
                .catch((error) => {
                    console.error("Link background enrichment failed:", error.message);
                });
        });

        return res.status(201).json({
            success: true,
            link: enrichedLink,
            collision: null
        });
    } catch (error) {
        return next(error);
    }
};

export const listLinks = async (req, res, next) => {
    try {
        const { projectId } = req.query;

        const agingContext = await updateAgingStatusesForProjects([projectId], req.user.userId);

        const links = await Link.find({
            projectId,
            status: { $ne: "dead" },
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("createdBy", "name email");

        const linkIds = links.map((link) => link._id);
        const commentStats = new Map();

        if (linkIds.length > 0) {
            const comments = await Comment.find({
                targetType: "Link",
                targetId: { $in: linkIds },
            })
                .sort({ createdAt: -1 })
                .populate("userId", "name avatarUrl email");

            for (const comment of comments) {
                const key = String(comment.targetId);
                const current = commentStats.get(key) || {
                    commentCount: 0,
                    unresolvedCommentCount: 0,
                    latestCommenter: null,
                    latestCommentAt: null,
                };

                current.commentCount += 1;
                if (!comment.resolved) {
                    current.unresolvedCommentCount += 1;
                }

                if (!current.latestCommenter) {
                    current.latestCommenter = comment.userId
                        ? {
                            id: comment.userId._id,
                            name: comment.userId.name,
                            avatarUrl: comment.userId.avatarUrl || null,
                        }
                        : null;
                    current.latestCommentAt = comment.createdAt;
                }

                commentStats.set(key, current);
            }
        }

        const enrichedLinks = links.map((link) => {
            const stats = commentStats.get(String(link._id)) || {
                commentCount: 0,
                unresolvedCommentCount: 0,
                latestCommenter: null,
                latestCommentAt: null,
            };

            return {
                ...toLinkWithAgingMeta(link, resolveSettingsForLink(link, agingContext)),
                commentCount: stats.commentCount,
                unresolvedCommentCount: stats.unresolvedCommentCount,
                latestCommenter: stats.latestCommenter,
                latestCommentAt: stats.latestCommentAt,
            };
        });

        return res.status(200).json({
            success: true,
            count: enrichedLinks.length,
            links: enrichedLinks
        });
    } catch (error) {
        return next(error);
    }
};

export const listDebateThreads = async (req, res, next) => {
    try {
        const { projectId } = req.query;

        const rooms = await Room.find({
            projectId,
            kind: "debate",
            isActive: true
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate("meta.linkIds", "url title summary");

        const roomIds = rooms.map((room) => room._id);
        const messages = await Message.find({ roomId: { $in: roomIds }, type: "ai" })
            .sort({ createdAt: 1 })
            .select("roomId text createdAt");

        const starterByRoom = new Map(messages.map((message) => [String(message.roomId), message]));

        const items = rooms.map((room) => ({
            room,
            starterMessage: starterByRoom.get(String(room._id)) || null
        }));

        return res.status(200).json({
            success: true,
            count: items.length,
            items
        });
    } catch (error) {
        return next(error);
    }
};

export const deleteLink = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const link = await Link.findById(id);
        if (!link) {
            return res.status(404).json({
                success: false,
                message: "Link not found"
            });
        }

        const project = await Project.findOne({
            _id: link.projectId,
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }]
        }).select("_id");

        if (!project) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you do not have access to this project"
            });
        }

        link.status = "dead";
        link.deletedAt = new Date();
        link.movedToCompostAt = new Date();
        link.graveyardReason = "deleted";
        await link.save();

        void publishDecayTelemetry({
            projectId: String(link.projectId),
            linkId: String(link._id),
            status: "dead",
            reason: "deleted",
            trigger: "manual_delete",
            userId,
        });

        await recordActivity({
            projectId: link.projectId,
            actorId: userId,
            type: "link_deleted",
            payload: {
                linkId: String(link._id),
                title: link.title || link.url,
                url: link.url,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Link moved to graveyard",
            deletedLinkId: String(link._id),
        });
    } catch (error) {
        return next(error);
    }
};

export const markLinkViewed = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const link = await Link.findById(id);
        if (!link) {
            return res.status(404).json({
                success: false,
                message: "Link not found",
            });
        }

        const project = await Project.findOne({
            _id: link.projectId,
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        }).select("_id");

        if (!project) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you do not have access to this project",
            });
        }

        link.clickCount = (link.clickCount || 0) + 1;
        link.lastClickedAt = new Date();
        link.status = "active";
        link.deletedAt = null;
        link.movedToCompostAt = null;
        link.graveyardReason = null;
        await link.save();

        void publishDecayTelemetry({
            projectId: String(link.projectId),
            linkId: String(link._id),
            status: "active",
            reason: "viewed",
            trigger: "link_view",
            userId,
        });

        return res.status(200).json({
            success: true,
            link: toLinkWithAgingMeta(link),
        });
    } catch (error) {
        return next(error);
    }
};

export const listGraveyardLinks = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const accessibleProjects = await Project.find({
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        })
            .select("_id name projectType")
            .lean();

        const projectIds = accessibleProjects.map((project) => project._id);
        const agingContext = await updateAgingStatusesForProjects(projectIds, userId);

        const projectById = new Map(accessibleProjects.map((project) => [String(project._id), project]));

        const links = await Link.find({
            projectId: { $in: projectIds },
            status: "dead",
        })
            .sort({ movedToCompostAt: -1, updatedAt: -1 })
            .limit(300)
            .populate("createdBy", "name email")
            .lean();

        const items = links.map((link) => {
            const project = projectById.get(String(link.projectId));
            const normalized = toLinkWithAgingMeta(link, resolveSettingsForLink(link, agingContext));

            return {
                ...normalized,
                project: project
                    ? {
                        id: String(project._id),
                        name: project.name,
                        projectType: project.projectType,
                    }
                    : null,
            };
        });

        return res.status(200).json({
            success: true,
            count: items.length,
            links: items,
        });
    } catch (error) {
        return next(error);
    }
};

export const restoreLinkFromGraveyard = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const link = await Link.findById(id);
        if (!link) {
            return res.status(404).json({
                success: false,
                message: "Link not found",
            });
        }

        const project = await Project.findOne({
            _id: link.projectId,
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        }).select("_id");

        if (!project) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you do not have access to this project",
            });
        }

        link.status = "active";
        link.deletedAt = null;
        link.movedToCompostAt = null;
        link.graveyardReason = null;
        link.lastClickedAt = new Date();
        await link.save();

        void publishDecayTelemetry({
            projectId: String(link.projectId),
            linkId: String(link._id),
            status: "active",
            reason: "restored",
            trigger: "graveyard_restore",
            userId,
        });

        await recordActivity({
            projectId: link.projectId,
            actorId: userId,
            type: "link_restored",
            payload: {
                linkId: String(link._id),
                title: link.title || link.url,
                url: link.url,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Link restored from graveyard",
            link: toLinkWithAgingMeta(link),
        });
    } catch (error) {
        return next(error);
    }
};

export const toggleLinkReaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { emoji } = req.body;
        const userId = req.user.userId;

        const normalizedEmoji = typeof emoji === "string" ? emoji.trim() : "";
        if (!normalizedEmoji) {
            return res.status(400).json({
                success: false,
                message: "emoji is required"
            });
        }

        const link = await Link.findById(id);
        if (!link) {
            return res.status(404).json({
                success: false,
                message: "Link not found"
            });
        }

        const project = await Project.findOne({
            _id: link.projectId,
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }]
        }).select("_id projectType");

        if (!project) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you do not have access to this project"
            });
        }

        if (project.projectType !== "collaborative") {
            return res.status(400).json({
                success: false,
                message: "Reactions are only available in collaborative projects"
            });
        }

        const userIdString = String(userId);
        const reactions = Array.isArray(link.reactions) ? link.reactions : [];
        const reactionIndex = reactions.findIndex((entry) => entry.emoji === normalizedEmoji);
        let reactionAction = "added";

        if (reactionIndex === -1) {
            reactions.push({ emoji: normalizedEmoji, users: [userId] });
            reactionAction = "added";
        } else {
            const currentUsers = Array.isArray(reactions[reactionIndex].users)
                ? reactions[reactionIndex].users.map((entry) => String(entry))
                : [];

            if (currentUsers.includes(userIdString)) {
                reactions[reactionIndex].users = reactions[reactionIndex].users.filter(
                    (entry) => String(entry) !== userIdString
                );
                reactionAction = "removed";

                if (!reactions[reactionIndex].users.length) {
                    reactions.splice(reactionIndex, 1);
                }
            } else {
                reactions[reactionIndex].users.push(userId);
                reactionAction = "added";
            }
        }

        link.reactions = reactions;
        await link.save();

        await recordActivity({
            projectId: link.projectId,
            actorId: userId,
            type: "reaction_updated",
            payload: {
                linkId: String(link._id),
                title: link.title || link.url,
                url: link.url,
                emoji: normalizedEmoji,
                action: reactionAction,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Reaction updated",
            link
        });
    } catch (error) {
        return next(error);
    }
};
