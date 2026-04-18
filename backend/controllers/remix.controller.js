import Link from "../models/link.js";
import Project from "../models/project.js";

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

        const myProjects = await Project.find({
            isActive: true,
            createdBy: userId,
        })
            .select("_id name")
            .lean();

        const myProjectIds = myProjects.map((project) => project._id);
        const myProjectById = new Map(myProjects.map((project) => [String(project._id), project]));

        const [forkedByMe, forksOfMine] = await Promise.all([
            Project.find({
                isActive: true,
                createdBy: userId,
                parentProjectId: { $ne: null },
            })
                .populate("createdBy", "name email avatarUrl")
                .populate("parentProjectId", "name createdBy")
                .sort({ createdAt: -1 })
                .limit(80)
                .lean(),
            Project.find({
                isActive: true,
                parentProjectId: { $in: myProjectIds },
                createdBy: { $ne: userId },
            })
                .populate("createdBy", "name email avatarUrl")
                .populate("parentProjectId", "name createdBy")
                .sort({ createdAt: -1 })
                .limit(80)
                .lean(),
        ]);

        const events = [];

        for (const project of forkedByMe) {
            events.push({
                id: `forked-by-me-${project._id}`,
                type: "forked_by_you",
                createdAt: project.createdAt,
                project: toProjectSummary(project),
                source: project.parentProjectId
                    ? {
                        id: String(project.parentProjectId._id),
                        name: project.parentProjectId.name,
                    }
                    : null,
            });

            events.push({
                id: `updated-by-me-${project._id}`,
                type: "updated_fork",
                createdAt: project.updatedAt,
                project: toProjectSummary(project),
                source: project.parentProjectId
                    ? {
                        id: String(project.parentProjectId._id),
                        name: project.parentProjectId.name,
                    }
                    : null,
            });
        }

        for (const fork of forksOfMine) {
            const parentId = String(fork.parentProjectId?._id || "");
            const parent = myProjectById.get(parentId);

            events.push({
                id: `forked-from-you-${fork._id}`,
                type: "forked_from_you",
                createdAt: fork.createdAt,
                project: toProjectSummary(fork),
                source: parent
                    ? {
                        id: String(parent._id),
                        name: parent.name,
                    }
                    : null,
                actor: fork.createdBy
                    ? {
                        id: String(fork.createdBy._id),
                        name: fork.createdBy.name,
                        avatarUrl: fork.createdBy.avatarUrl || null,
                    }
                    : null,
            });
        }

        events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return res.status(200).json({
            success: true,
            count: events.length,
            events: events.slice(0, 120),
        });
    } catch (error) {
        return next(error);
    }
};