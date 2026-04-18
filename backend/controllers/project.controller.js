import Project from "../models/project.js";
import ProjectMember from "../models/projectMember.js";

export const createProject = async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Project name is required"
            });
        }

        const project = await Project.create({
            name: name.trim(),
            createdBy: req.user.userId
        });

        await ProjectMember.create({
            userId: req.user.userId,
            projectId: project._id,
            role: "owner"
        });

        return res.status(201).json({
            success: true,
            project
        });
    } catch (error) {
        return next(error);
    }
};
