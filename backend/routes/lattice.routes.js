import express from "express";
import Project from "../models/project.js";

const router = express.Router();

router.get("/lattices", async (req, res, next) => {
    try {
        const projects = await Project.find({})
            .populate("createdBy", "name email")
            .populate("members", "name email")
            .sort({ updatedAt: -1 })
            .lean();

        const lattices = projects.map((project) => {
            const members = Array.isArray(project.members) ? project.members : [];
            const createdById = String(project.createdBy?._id || project.createdBy || "");

            return {
                id: String(project._id),
                name: project.name,
                createdBy: project.createdBy,
                memberCount: members.length,
                kind: members.length > 1 || (members.length === 1 && String(members[0]?._id) !== createdById) ? "collaborative" : "personal",
                updatedAt: project.updatedAt,
                createdAt: project.createdAt,
            };
        });

        return res.status(200).json({
            success: true,
            lattices,
        });
    } catch (error) {
        return next(error);
    }
});

export default router;