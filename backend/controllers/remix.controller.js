import Link from "../models/link.js";
import Project from "../models/project.js";
import ProjectMember from "../models/projectMember.js";
import ActivityLog from "../models/activityLog.js";
import { recordActivity } from "../services/activityLog.service.js";

const toProjectSummary = (project) => ({
    id: String(project._id),
    name: project.name,
    projectType: project.projectType,
    isPublic: Boolean(project.isPublic),
    parentProjectId: project.parentProjectId || null,
    rootProjectId: project.rootProjectId || null,
    lineageDepth: Number.isFinite(project.lineageDepth) ? project.lineageDepth : 0,
    remixCount: Number.isFinite(project.remixCount) ? project.remixCount : 0,
    createdBy: project.createdBy
        ? {
            id: String(project.createdBy._id || project.createdBy),
            name: project.createdBy.name || "",
            email: project.createdBy.email || "",
            avatarUrl: project.createdBy.avatarUrl || null,
        }
        : null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
});

const isProjectMember = (project, userId) => {
    if (!project || !userId) {
        return false;
    }

    if (String(project.createdBy) === String(userId)) {
        return true;
    }

    return Array.isArray(project.members) && project.members.some((memberId) => String(memberId) === String(userId));
};

const buildLineageTree = (projects, rootId) => {
    const byId = new Map(projects.map((project) => [String(project._id), project]));
    const childrenByParent = new Map();

    for (const project of projects) {
        const parentKey = project.parentProjectId ? String(project.parentProjectId) : null;
        if (!parentKey) {
            continue;
        }

        if (!childrenByParent.has(parentKey)) {
            childrenByParent.set(parentKey, []);
        }

        childrenByParent.get(parentKey).push(project);
    }

    const countDescendants = (projectId) => {
        const directChildren = childrenByParent.get(projectId) || [];
        return directChildren.reduce((count, child) => count + 1 + countDescendants(String(child._id)), 0);
    };

    const toNode = (project) => {
        const id = String(project._id);
        const directChildren = (childrenByParent.get(id) || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        return {
            project: toProjectSummary(project),
            directRemixes: directChildren.map((child) => toProjectSummary(child)),
            totalDescendants: countDescendants(id),
            children: directChildren.map((child) => toNode(child)),
        };
    };

    const rootProject = byId.get(String(rootId));
    if (!rootProject) {
        return null;
    }

    return toNode(rootProject);
};

export const listPublicProjects = async (req, res, next) => {
    try {
        const search = (req.query.search || "").trim();
        const query = {
            isActive: true,
            isPublic: true,
        };

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const projects = await Project.find(query)
            .sort({ updatedAt: -1 })
            .limit(100)
            .populate("createdBy", "name email avatarUrl");

        return res.status(200).json({
            success: true,
            count: projects.length,
            projects: projects.map(toProjectSummary),
        });
    } catch (error) {
        return next(error);
    }
};

export const updateProjectVisibility = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { isPublic } = req.body;
        const userId = req.user.userId;

        const project = await Project.findById(projectId);
        if (!project || !project.isActive) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        if (String(project.createdBy) !== String(userId)) {
            return res.status(403).json({ success: false, message: "Forbidden: only curator can update visibility" });
        }

        project.isPublic = Boolean(isPublic);
        await project.save();

        const hydrated = await Project.findById(project._id).populate("createdBy", "name email avatarUrl");

        return res.status(200).json({
            success: true,
            message: "Project visibility updated",
            project: toProjectSummary(hydrated),
        });
    } catch (error) {
        return next(error);
    }
};

export const forkProject = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { name } = req.body;
        const userId = req.user.userId;

        const sourceProject = await Project.findById(projectId).populate("createdBy", "name email avatarUrl");
        if (!sourceProject || !sourceProject.isActive) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        if (!sourceProject.isPublic && !isProjectMember(sourceProject, userId)) {
            return res.status(403).json({ success: false, message: "Forbidden: source project must be public to fork" });
        }

        const forkedName = (name || `${sourceProject.name} (Fork)`).trim();
        const rootId = sourceProject.rootProjectId || sourceProject._id;

        const forkedProject = await Project.create({
            name: forkedName,
            projectType: sourceProject.projectType,
            isPublic: false,
            parentProjectId: sourceProject._id,
            rootProjectId: rootId,
            lineageDepth: (sourceProject.lineageDepth || 0) + 1,
            remixCount: 0,
            isActive: true,
            createdBy: userId,
            members: [userId],
        });

        if (!forkedProject.rootProjectId) {
            forkedProject.rootProjectId = forkedProject._id;
            await forkedProject.save();
        }

        await Project.findByIdAndUpdate(sourceProject._id, {
            $inc: { remixCount: 1 },
        });

        const sourceLinks = await Link.find({ projectId: sourceProject._id }).lean();

        if (sourceLinks.length > 0) {
            const forkedLinks = sourceLinks.map((link) => ({
                projectId: forkedProject._id,
                url: link.url,
                title: link.title,
                description: link.description,
                image: link.image,
                summary: link.summary,
                tags: Array.isArray(link.tags) ? link.tags : [],
                vibe: link.vibe,
                deadline: link.deadline || null,
                embedding: link.embedding,
                embeddingModel: link.embeddingModel,
                collisionCheckedAt: link.collisionCheckedAt,
                createdBy: userId,
                clickCount: 0,
                lastClickedAt: new Date(),
                status: link.status || "active",
                accessType: "public",
                allowedRoles: [],
                reactions: [],
            }));

            await Link.insertMany(forkedLinks, { ordered: false });
        }

        const hydratedFork = await Project.findById(forkedProject._id).populate("createdBy", "name email avatarUrl");

        await recordActivity({
            projectId: forkedProject._id,
            actorId: userId,
            type: "forked_by_you",
            payload: {
                sourceProjectId: String(sourceProject._id),
                sourceProjectName: sourceProject.name,
                forkProjectId: String(forkedProject._id),
                forkProjectName: forkedProject.name,
                copiedLinks: sourceLinks.length,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Project forked successfully",
            project: toProjectSummary(hydratedFork),
            copiedLinks: sourceLinks.length,
            forkMeta: {
                sourceProjectId: sourceProject._id,
                rootProjectId: rootId,
                lineageDepth: forkedProject.lineageDepth,
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const getProjectLineage = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.userId;

        const project = await Project.findById(projectId).populate("createdBy", "name email avatarUrl");
        if (!project || !project.isActive) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        const canAccess = project.isPublic || isProjectMember(project, userId);
        if (!canAccess) {
            return res.status(403).json({ success: false, message: "Forbidden: no access to this lineage" });
        }

        const rootId = project.rootProjectId || project._id;

        const family = await Project.find({
            isActive: true,
            $or: [{ _id: rootId }, { rootProjectId: rootId }],
        })
            .populate("createdBy", "name email avatarUrl")
            .sort({ createdAt: 1 });

        const tree = buildLineageTree(family, rootId);

        const path = [];
        let cursor = project;

        while (cursor) {
            path.unshift(toProjectSummary(cursor));
            if (!cursor.parentProjectId) {
                break;
            }

            // eslint-disable-next-line no-await-in-loop
            cursor = await Project.findById(cursor.parentProjectId).populate("createdBy", "name email avatarUrl");
        }

        return res.status(200).json({
            success: true,
            lineage: {
                root: tree?.project || null,
                path,
                tree,
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const getForkActivity = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const requestedHours = Number(req.query.hours);
        const windowHours = [24, 48].includes(requestedHours) ? requestedHours : 48;
        const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

        const [projectDocs, membershipDocs] = await Promise.all([
            Project.find({
                isActive: true,
                $or: [{ createdBy: userId }, { members: userId }],
            })
                .select("_id name")
                .lean(),
            ProjectMember.find({ userId })
                .select("projectId")
                .lean(),
        ]);

        const directProjectIds = Array.from(new Set([
            ...projectDocs.map((project) => String(project._id)),
            ...membershipDocs.map((membership) => String(membership.projectId)),
        ])).filter(Boolean);

        const directProjects = directProjectIds.length > 0
            ? await Project.find({ _id: { $in: directProjectIds }, isActive: true })
                .select("_id rootProjectId")
                .lean()
            : [];

        const sharedRootIds = Array.from(new Set(
            directProjects.map((project) => String(project.rootProjectId || project._id)).filter(Boolean)
        ));

        const accessibleProjects = (directProjectIds.length > 0 || sharedRootIds.length > 0)
            ? await Project.find({
                isActive: true,
                $or: [
                    { _id: { $in: directProjectIds } },
                    { rootProjectId: { $in: sharedRootIds } },
                ],
            }).select("_id name rootProjectId parentProjectId createdBy").lean()
            : [];

        if (accessibleProjects.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                windowHours,
                windowStart,
                generatedAt: new Date(),
                events: [],
            });
        }

        const logs = await ActivityLog.find({
            projectId: { $in: accessibleProjects.map((project) => project._id) },
            createdAt: { $gte: windowStart },
        })
            .populate("projectId", "name")
            .populate("actorId", "name avatarUrl")
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        const events = logs.map((log) => ({
            id: String(log._id),
            type: log.type,
            createdAt: log.createdAt,
            project: {
                id: String(log.projectId?._id || log.projectId),
                name: log.projectId?.name || "Unknown lattice",
            },
            actor: {
                id: String(log.actorId?._id || log.actorId),
                name: log.actorId?.name || "Unknown user",
                avatarUrl: log.actorId?.avatarUrl || null,
                isYou: String(log.actorId?._id || log.actorId) === String(userId),
            },
            payload: log.payload || {},
            link: log.payload?.linkId
                ? {
                    id: String(log.payload.linkId),
                    title: log.payload.title || "Untitled link",
                    url: log.payload.url || null,
                }
                : null,
            source: log.payload?.sourceProjectName
                ? {
                    id: String(log.payload.sourceProjectId || ""),
                    name: log.payload.sourceProjectName,
                }
                : null,
        }));

        return res.status(200).json({
            success: true,
            count: events.length,
            windowHours,
            windowStart,
            generatedAt: new Date(),
            events: events.slice(0, 120),
        });
    } catch (error) {
        return next(error);
    }
};