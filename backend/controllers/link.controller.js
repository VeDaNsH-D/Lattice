import Link from "../models/link.js";
import Message from "../models/message.js";
import Room from "../models/room.js";
import { ensureLinkEnrichment, processNewLinkForCollision } from "../services/link-intelligence.service.js";

export const createLink = async (req, res, next) => {
    try {
        const {
            projectId,
            url,
            title,
            description,
            image,
            tags,
            vibe,
            accessType,
            allowedRoles
        } = req.body;

        const link = await Link.create({
            projectId,
            url,
            title,
            description,
            image,
            tags,
            vibe,
            accessType,
            allowedRoles,
            createdBy: req.user.userId
        });

        await ensureLinkEnrichment(link);
        const collision = await processNewLinkForCollision(link);
        const enrichedLink = await Link.findById(link._id);

        return res.status(201).json({
            success: true,
            link: enrichedLink,
            collision
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
