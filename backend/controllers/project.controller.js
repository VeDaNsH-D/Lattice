import Project from "../models/project.js";
import ProjectMember from "../models/projectMember.js";
import User from "../models/user.js";
import { recordActivity } from "../services/activityLog.service.js";

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

        await recordActivity({
            projectId: createdProject._id,
            actorId: userId,
            type: "project_created",
            payload: {
                projectName: createdProject.name,
                projectType: createdProject.projectType,
            },
        });

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

export const getProjectMembers = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.params;

        // Fetch raw project IDs so member list always comes from project.members in DB.
        const project = await Project.findById(projectId)
            .select("createdBy members isActive")
            .lean();

        if (!project || !project.isActive) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        const ownerId = String(project.createdBy || "");
        const membersArray = Array.isArray(project.members) ? project.members : [];
        const userIdStr = String(userId);

        const isOwner = ownerId === userIdStr;
        const isMember = membersArray.some((memberId) => String(memberId) === userIdStr);

        if (!isOwner && !isMember) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: you are not a member of this project"
            });
        }

        // Build a stable ordered list: owner first, then members from project.members.
        const orderedIds = [];
        const seenIds = new Set();

        if (ownerId) {
            seenIds.add(ownerId);
            orderedIds.push(ownerId);
        }

        membersArray.forEach((memberIdRaw) => {
            const memberId = String(memberIdRaw || "");
            if (memberId && !seenIds.has(memberId)) {
                seenIds.add(memberId);
                orderedIds.push(memberId);
            }
        });

        const users = await User.find({ _id: { $in: orderedIds } })
            .select("name avatarUrl email")
            .lean();

        const userMap = new Map(users.map((user) => [String(user._id), user]));

        const members = orderedIds.map((id) => {
            const userDoc = userMap.get(id);

            return {
                id,
                name: userDoc?.name || "Unknown",
                avatar: userDoc?.avatarUrl || null,
                email: userDoc?.email || null,
                isOwner: id === ownerId,
            };
        });

        return res.status(200).json({
            success: true,
            members,
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
