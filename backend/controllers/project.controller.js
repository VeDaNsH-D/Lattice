import Project from "../models/project.js";

const getProjectDescription = (projectDoc) => {
    if (typeof projectDoc?.description === "string" && projectDoc.description.trim()) {
        return projectDoc.description.trim();
    }

    if (projectDoc?.projectType === "collaborative") {
        return "Shared lattice for collaborative work.";
    }

    return "Personal lattice for your own ideas and bookmarks.";
};

const normalizeProject = (projectDoc) => ({
    id: projectDoc._id,
    name: projectDoc.name,
    projectType: projectDoc.projectType || "personal",
    isActive: projectDoc.isActive,
    isPublic: Boolean(projectDoc.isPublic),
    description: getProjectDescription(projectDoc),
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

export const getProjectById = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.params;

        const project = await Project.findOne({
            _id: projectId,
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        })
            .populate("createdBy", "name email avatarUrl")
            .populate("members", "name avatarUrl")
            .lean();

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        const ownerId = String(project.createdBy?._id || project.createdBy || "");
        const membersFromProject = Array.isArray(project.members) ? project.members : [];
        const seenMemberIds = new Set();
        const members = [];

        if (ownerId) {
            seenMemberIds.add(ownerId);
            members.push({
                _id: ownerId,
                name: project.createdBy?.name || "User",
                avatar: project.createdBy?.avatarUrl || null,
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
            project: {
                ...normalizeProject(project),
                members,
            },
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

        const hydratedProject = await Project.findById(lattice._id).populate("createdBy", "name email");

        return res.status(200).json({
            success: true,
            lattice: normalizeProject(hydratedProject),
        });
    } catch (error) {
        return next(error);
    }
};

export { normalizeProject };
