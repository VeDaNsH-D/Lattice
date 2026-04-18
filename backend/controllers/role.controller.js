import mongoose from "mongoose";

import Project from "../models/project.js";
import Role from "../models/role.js";

const normalizeRole = (role) => ({
    id: role._id,
    name: role.name,
    permissions: role.permissions
});

export const createRole = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { projectId, name, permissions } = req.body;

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Valid projectId is required"
            });
        }

        const project = await Project.findById(projectId).select("_id createdBy projectType roles isActive");

        if (!project || !project.isActive) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        if (project.projectType !== "collaborative") {
            return res.status(400).json({
                success: false,
                message: "Roles can only be created for collaborative projects"
            });
        }

        if (String(project.createdBy) !== String(userId)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: only project owner can create roles"
            });
        }

        const createdRole = await Role.create({
            projectId,
            name: name.trim(),
            permissions,
            createdBy: userId
        });

        project.roles = [...(project.roles || []), createdRole._id];
        await project.save();

        return res.status(201).json({
            success: true,
            role: normalizeRole(createdRole)
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Role name already exists in this project"
            });
        }

        return next(error);
    }
};

export const listRolesByProject = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.query;

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Valid projectId is required"
            });
        }

        const project = await Project.findOne({
            _id: projectId,
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }]
        }).select("_id");

        if (!project) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you do not have access to this project"
            });
        }

        const roles = await Role.find({ projectId: project._id })
            .sort({ createdAt: 1 })
            .select("name permissions");

        return res.status(200).json({
            success: true,
            roles: roles.map(normalizeRole)
        });
    } catch (error) {
        return next(error);
    }
};
