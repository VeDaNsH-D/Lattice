import Comment from "../models/comment.js";
import Link from "../models/link.js";
import Project from "../models/project.js";
import { recordActivity } from "../services/activityLog.service.js";

const normalizeComment = (commentDoc) => ({
    id: commentDoc._id,
    _id: commentDoc._id,
    targetId: commentDoc.targetId,
    targetType: commentDoc.targetType,
    text: commentDoc.text,
    gifUrl: commentDoc.gifUrl || null,
    resolved: Boolean(commentDoc.resolved),
    resolvedBy: commentDoc.resolvedBy
        ? {
            id: commentDoc.resolvedBy._id,
            name: commentDoc.resolvedBy.name,
            avatarUrl: commentDoc.resolvedBy.avatarUrl || null,
        }
        : null,
    resolvedAt: commentDoc.resolvedAt,
    user: commentDoc.userId
        ? {
            id: commentDoc.userId._id,
            name: commentDoc.userId.name,
            avatarUrl: commentDoc.userId.avatarUrl || null,
            email: commentDoc.userId.email,
        }
        : null,
    createdAt: commentDoc.createdAt,
    updatedAt: commentDoc.updatedAt,
});

const ensureLinkAccess = async ({ userId, linkId }) => {
    const link = await Link.findById(linkId).select("_id projectId createdBy isActive accessType allowedRoles");
    if (!link || !link.isActive) {
        return { ok: false, status: 404, message: "Link not found" };
    }

    const project = await Project.findOne({
        _id: link.projectId,
        isActive: true,
        $or: [{ createdBy: userId }, { members: userId }],
    }).select("_id createdBy members");

    if (!project) {
        return { ok: false, status: 403, message: "Forbidden: you do not have access to this project" };
    }

    return { ok: true, link, project };
};

export const listLinkComments = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { linkId } = req.params;

        const access = await ensureLinkAccess({ userId, linkId });
        if (!access.ok) {
            return res.status(access.status).json({ success: false, message: access.message });
        }

        const comments = await Comment.find({
            targetType: "Link",
            targetId: access.link._id,
        })
            .sort({ createdAt: 1 })
            .populate("userId", "name avatarUrl email")
            .populate("resolvedBy", "name avatarUrl email");

        return res.status(200).json({
            success: true,
            count: comments.length,
            comments: comments.map(normalizeComment),
        });
    } catch (error) {
        return next(error);
    }
};

export const createLinkComment = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { linkId } = req.params;
        const { text, gifUrl = null } = req.body;

        const trimmedText = typeof text === "string" ? text.trim() : "";
        if (!trimmedText && !gifUrl) {
            return res.status(400).json({ success: false, message: "Comment text is required" });
        }

        const access = await ensureLinkAccess({ userId, linkId });
        if (!access.ok) {
            return res.status(access.status).json({ success: false, message: access.message });
        }

        const comment = await Comment.create({
            targetId: access.link._id,
            targetType: "Link",
            userId,
            text: trimmedText,
            gifUrl,
            resolved: false,
            resolvedBy: null,
            resolvedAt: null,
        });

        const hydrated = await Comment.findById(comment._id)
            .populate("userId", "name avatarUrl email")
            .populate("resolvedBy", "name avatarUrl email");

        await recordActivity({
            projectId: access.link.projectId,
            actorId: userId,
            type: "comment_added",
            payload: {
                commentId: String(comment._id),
                linkId: String(access.link._id),
                title: access.link.title || access.link.url,
                url: access.link.url,
            },
        });

        return res.status(201).json({ success: true, comment: normalizeComment(hydrated) });
    } catch (error) {
        return next(error);
    }
};

export const toggleLinkCommentResolution = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { commentId } = req.params;
        const { resolved } = req.body;

        const comment = await Comment.findById(commentId);
        if (!comment || comment.targetType !== "Link") {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const link = await Link.findById(comment.targetId).select("_id projectId isActive title url");
        if (!link || !link.isActive) {
            return res.status(404).json({ success: false, message: "Link not found" });
        }

        const project = await Project.findOne({
            _id: link.projectId,
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        }).select("_id");

        if (!project) {
            return res.status(403).json({ success: false, message: "Forbidden: you do not have access to this project" });
        }

        const nextResolved = typeof resolved === "boolean" ? resolved : !comment.resolved;
        comment.resolved = nextResolved;
        comment.resolvedBy = nextResolved ? userId : null;
        comment.resolvedAt = nextResolved ? new Date() : null;

        await comment.save();

        const hydrated = await Comment.findById(comment._id)
            .populate("userId", "name avatarUrl email")
            .populate("resolvedBy", "name avatarUrl email");

        if (nextResolved) {
            await recordActivity({
                projectId: link.projectId,
                actorId: userId,
                type: "comment_resolved",
                payload: {
                    commentId: String(comment._id),
                    linkId: String(link._id),
                    title: link.title || link.url,
                    url: link.url,
                },
            });
        }

        return res.status(200).json({ success: true, comment: normalizeComment(hydrated) });
    } catch (error) {
        return next(error);
    }
};