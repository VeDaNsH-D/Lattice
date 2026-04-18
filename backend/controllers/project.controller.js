import Project from "../models/project.js";
import ProjectMember from "../models/projectMember.js";

const normalizeProject = (projectDoc) => ({
    id: projectDoc._id,
    name: projectDoc.name,
    projectType: projectDoc.projectType || "personal",
    isPublic: Boolean(projectDoc.isPublic),
    parentProjectId: projectDoc.parentProjectId || null,
    rootProjectId: projectDoc.rootProjectId || null,
    lineageDepth: Number.isFinite(projectDoc.lineageDepth) ? projectDoc.lineageDepth : 0,
    remixCount: Number.isFinite(projectDoc.remixCount) ? projectDoc.remixCount : 0,
    isActive: projectDoc.isActive,
    memberCount: Array.isArray(projectDoc.members) ? projectDoc.members.length : 0,
    createdBy: projectDoc.createdBy
        ? {
            id: projectDoc.createdBy._id,
            name: projectDoc.createdBy.name,
            email: projectDoc.createdBy.email,
            avatarUrl: projectDoc.createdBy.avatarUrl || null,
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
            isPublic: false,
            parentProjectId: null,
            rootProjectId: null,
            lineageDepth: 0,
            remixCount: 0,
            isActive: true,
            createdBy: userId,
            members: [userId],
        });

        if (!createdProject.rootProjectId) {
            createdProject.rootProjectId = createdProject._id;
            await createdProject.save();
        }

        const hydratedProject = await Project.findById(createdProject._id).populate("createdBy", "name email avatarUrl");

        return res.status(201).json({
            success: true,
            project: normalizeProject(hydratedProject),
        });
    } catch (error) {
        return next(error);
    }
};

export const getProjectMembership = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.params;

        const projectMember = await ProjectMember.findOne({ userId, projectId })
            .populate("roleId", "name permissions");

        if (!projectMember) {
            return res.status(404).json({
                success: false,
                message: "Membership not found"
            });
        }

        return res.status(200).json({
            success: true,
            membership: {
                id: projectMember._id,
                projectId: projectMember.projectId,
                userId: projectMember.userId,
                role: projectMember.roleId
                    ? {
                        id: projectMember.roleId._id,
                        name: projectMember.roleId.name,
                        permissions: projectMember.roleId.permissions,
                    }
                    : null,
            }
        });
    } catch (error) {
        return next(error);
    }
};

export const updateLatticeVisibility = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { latticeId } = req.params;
        const { isPublic } = req.body;

        const lattice = await Project.findById(latticeId);

        if (!lattice || !lattice.isActive) {
            return res.status(404).json({
                success: false,
                message: "Lattice not found",
            });
        }

        if (String(lattice.createdBy) !== String(userId)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you cannot modify this lattice",
            });
        }

        lattice.isPublic = Boolean(isPublic);
        await lattice.save();

        const hydratedProject = await Project.findById(lattice._id).populate("createdBy", "name email avatarUrl");

        return res.status(200).json({
            success: true,
            lattice: normalizeProject(hydratedProject),
        });
    } catch (error) {
        return next(error);
    }
};

export { normalizeProject };
