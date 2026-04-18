import mongoose from "mongoose";
import { PERMISSIONS } from "../constants/permissions.js";
import ProjectMember from "../models/projectMember.js";
import Role from "../models/role.js";

export const createRole = async (req, res, next) => {
    try {
        const { name, projectId, permissions } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Role name is required"
            });
        }

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Valid projectId is required"
            });
        }

        if (!permissions) {
            return res.status(400).json({
                success: false,
                message: "permissions is required"
            });
        }

        if (!PERMISSIONS.includes(permissions)) {
            return res.status(400).json({
                success: false,
                message: "Invalid permission type"
            });
        }

        const member = await ProjectMember.findOne({
            userId: req.user.userId,
            projectId
        });

        if (!member) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you are not a project member"
            });
        }

        if (member.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "Forbidden: only project owner can create roles"
            });
        }

        const role = await Role.create({
            name: name.trim(),
            projectId,
            permissions,
            createdBy: req.user.userId
        });

        return res.status(201).json({
            success: true,
            role
        });
    } catch (error) {
        return next(error);
    }
};

export const getProjectRoles = async (req, res, next) => {
    try {
        const { projectId } = req.params;

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Valid projectId is required"
            });
        }

        const member = await ProjectMember.findOne({
            userId: req.user.userId,
            projectId
        });

        if (!member) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you are not a project member"
            });
        }

        const roles = await Role.find({ projectId }).sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            roles
        });
    } catch (error) {
        return next(error);
    }
};
