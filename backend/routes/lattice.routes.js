import express from "express";
import { body, param } from "express-validator";

import Project from "../models/project.js";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import { updateLatticeVisibility } from "../controllers/project.controller.js";

const router = express.Router();

router.get("/lattices", authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const projects = await Project.find({
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        })
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

router.get(
    "/lattices/:latticeId",
    [param("latticeId").isMongoId().withMessage("Valid lattice id is required")],
    validateRequest,
    optionalAuthMiddleware,
    async (req, res, next) => {
        try {
            const { latticeId } = req.params;

            const lattice = await Project.findById(latticeId)
                .populate("createdBy", "name email avatarUrl")
                .populate("members", "name avatarUrl")
                .lean();

            if (!lattice || !lattice.isActive) {
                return res.status(404).json({
                    success: false,
                    message: "Lattice not found",
                });
            }

            if (!lattice.isPublic) {
                if (!req.user?.userId) {
                    return res.status(401).json({
                        success: false,
                        message: "Please login to view this lattice",
                    });
                }

                if (String(lattice.createdBy?._id || lattice.createdBy) !== String(req.user.userId)) {
                    return res.status(403).json({
                        success: false,
                        message: "You do not have access to this lattice",
                    });
                }
            }

            const ownerId = String(lattice.createdBy?._id || lattice.createdBy || "");
            const membersFromProject = Array.isArray(lattice.members) ? lattice.members : [];
            const seenMemberIds = new Set();
            const members = [];

            if (ownerId) {
                seenMemberIds.add(ownerId);
                members.push({
                    _id: ownerId,
                    name: lattice.createdBy?.name || "User",
                    avatar: lattice.createdBy?.avatarUrl || null,
                    isOwner: true,
                });
            }

            membersFromProject.forEach((member) => {
                const memberId = String(member?._id || "");

                if (!memberId || seenMemberIds.has(memberId)) {
                    return;
                }

                seenMemberIds.add(memberId);
                members.push({
                    _id: memberId,
                    name: member?.name || "User",
                    avatar: member?.avatarUrl || null,
                    isOwner: memberId === ownerId,
                });
            });

            return res.status(200).json({
                success: true,
                lattice: {
                    id: String(lattice._id),
                    name: lattice.name,
                    projectType: lattice.projectType || "personal",
                    isPublic: Boolean(lattice.isPublic),
                    isActive: Boolean(lattice.isActive),
                    description: typeof lattice.description === "string" ? lattice.description : "",
                    members,
                    createdBy: lattice.createdBy
                        ? {
                            id: String(lattice.createdBy._id || lattice.createdBy),
                            name: lattice.createdBy.name || "User",
                            avatarUrl: lattice.createdBy.avatarUrl || null,
                        }
                        : null,
                    createdAt: lattice.createdAt,
                    updatedAt: lattice.updatedAt,
                },
            });
        } catch (error) {
            return next(error);
        }
    }
);

router.patch(
    "/lattices/:latticeId/visibility",
    authMiddleware,
    [
        param("latticeId").isMongoId().withMessage("Valid lattice id is required"),
        body("isPublic").isBoolean().withMessage("isPublic must be a boolean"),
    ],
    validateRequest,
    updateLatticeVisibility
);

export default router;