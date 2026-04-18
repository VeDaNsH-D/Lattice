import Link from "../models/link.js";
import Message from "../models/message.js";
import Project from "../models/project.js";
import Room from "../models/room.js";
import { fetchMetadata } from "../services/metadata.service.js";
import { generateAIContent } from "../services/ai.service.js";
import { ensureLinkEnrichment, processNewLinkForCollision } from "../services/link-intelligence.service.js";
import { buildGraphNode } from "../services/graph.service.js";

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

        // Generate AI content (tags, summary, vibe) if not provided
        let aiContent = { summary: null, tags: [], vibe: null };
        if (!tags || tags.length === 0 || !vibe) {
            aiContent = await generateAIContent(resolvedTitle, resolvedDescription);
        }

        const finalTags = tags && tags.length > 0 ? tags : aiContent.tags;
        const finalVibe = vibe || aiContent.vibe;

        const link = await Link.create({
            projectId,
            url,
            title: resolvedTitle,
            description: resolvedDescription,
            image: resolvedImage,
            tags: finalTags,
            vibe: finalVibe,
            deadline: normalizedDeadline,
            accessType,
            allowedRoles,
            createdBy: req.user.userId
        });

        const enrichedLink = await Link.findById(link._id);

        setImmediate(() => {
            Promise.resolve()
                .then(() => ensureLinkEnrichment(link))
                .then(() => processNewLinkForCollision(link))
                .then(() => buildGraphNode({
                    _id: link._id,
                    title: link.title || link.url,
                    summary: link.summary || link.description || "",
                    tags: link.tags || [],
                    embedding: link.embedding,
                    latticeId: link.projectId,
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

        const links = await Link.find({ projectId })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("createdBy", "name email");

        return res.status(200).json({
            success: true,
            count: links.length,
            links
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

        const link = await Link.findById(id).select("_id projectId createdBy");
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

        await Link.deleteOne({ _id: link._id });

        return res.status(200).json({
            success: true,
            message: "Link deleted successfully",
            deletedLinkId: String(link._id)
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

        if (reactionIndex === -1) {
            reactions.push({ emoji: normalizedEmoji, users: [userId] });
        } else {
            const currentUsers = Array.isArray(reactions[reactionIndex].users)
                ? reactions[reactionIndex].users.map((entry) => String(entry))
                : [];

            if (currentUsers.includes(userIdString)) {
                reactions[reactionIndex].users = reactions[reactionIndex].users.filter(
                    (entry) => String(entry) !== userIdString
                );

                if (!reactions[reactionIndex].users.length) {
                    reactions.splice(reactionIndex, 1);
                }
            } else {
                reactions[reactionIndex].users.push(userId);
            }
        }

        link.reactions = reactions;
        await link.save();

        return res.status(200).json({
            success: true,
            message: "Reaction updated",
            link
        });
    } catch (error) {
        return next(error);
    }
};
