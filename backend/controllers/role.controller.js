import mongoose from "mongoose";

import Project from "../models/project.js";
import Role from "../models/role.js";

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
            roles: roles.map((role) => ({
                id: role._id,
                name: role.name,
                permissions: role.permissions
            }))
        });
    } catch (error) {
        return next(error);
    }
};
