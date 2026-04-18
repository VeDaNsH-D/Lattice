import Project from "../models/project.js";

const normalizeProject = (projectDoc) => ({
    id: projectDoc._id,
    name: projectDoc.name,
    projectType: projectDoc.projectType || "personal",
    isActive: projectDoc.isActive,
    memberCount: Array.isArray(projectDoc.members) ? projectDoc.members.length : 0,
    createdBy: projectDoc.createdBy
        ? {
            id: projectDoc.createdBy._id,
            name: projectDoc.createdBy.name,
            email: projectDoc.createdBy.email,
        }
        : null,
    createdAt: projectDoc.createdAt,
    updatedAt: projectDoc.updatedAt,
});

export const listProjects = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const projects = await Project.find({
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        })
            .sort({ updatedAt: -1 })
            .populate("createdBy", "name email");

        const personalProjects = projects
            .filter((project) => project.projectType !== "collaborative")
            .map(normalizeProject);

        const collaborativeProjects = projects
            .filter((project) => project.projectType === "collaborative")
            .map(normalizeProject);

        return res.status(200).json({
            success: true,
            personalProjects,
            collaborativeProjects,
        });
    } catch (error) {
        return next(error);
    }
};

export const createProject = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { name, projectType } = req.body;

        const createdProject = await Project.create({
            name: name.trim(),
            projectType,
            isActive: true,
            createdBy: userId,
            members: [userId],
        });

        const hydratedProject = await Project.findById(createdProject._id).populate("createdBy", "name email");

        return res.status(201).json({
            success: true,
            project: normalizeProject(hydratedProject),
        });
    } catch (error) {
        return next(error);
    }
};
