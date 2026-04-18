import mongoose from "mongoose";
import User from "../models/user.js";
import Link from "../models/link.js";
import ProjectMember from "../models/projectMember.js";
import Project from "../models/project.js";
import LatticeNode from "../models/latticeNode.js";

const clampLimit = (value, fallback = 8, max = 20) => {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.min(parsed, max);
};

const buildRegexQuery = (query) => {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, "i");
};

const toProjectSummary = (project) => ({
    id: String(project._id),
    name: project.name,
    kind: project.projectType === "collaborative" ? "collaborative" : "personal",
    isPublic: Boolean(project.isPublic),
    createdBy: project.createdBy
        ? {
            id: String(project.createdBy._id || project.createdBy),
            name: project.createdBy.name || "",
            email: project.createdBy.email || "",
            avatarUrl: project.createdBy.avatarUrl || null,
        }
        : null,
    updatedAt: project.updatedAt,
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchDiscover = async (req, res, next) => {
    try {
        const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
        const limit = clampLimit(req.query.limit, 10, 20);

        const regexQuery = query ? new RegExp(escapeRegex(query), "i") : null;

        const [users, publicProjects] = await Promise.all([
            User.find(
                regexQuery
                    ? {
                        $or: [{ name: regexQuery }, { email: regexQuery }],
                    }
                    : {}
            )
                .select("name email avatarUrl updatedAt")
                .sort({ updatedAt: -1 })
                .limit(limit)
                .lean(),
            Project.find(
                {
                    isActive: true,
                    isPublic: true,
                    ...(regexQuery ? { name: regexQuery } : {}),
                }
            )
                .populate("createdBy", "name email avatarUrl")
                .sort({ updatedAt: -1 })
                .limit(limit)
                .lean(),
        ]);

        const publicProjectsByUser = new Map();
        if (users.length > 0) {
            const userIds = users.map((user) => user._id);
            const userPublicProjects = await Project.find({
                isActive: true,
                isPublic: true,
                createdBy: { $in: userIds },
            })
                .populate("createdBy", "name email avatarUrl")
                .sort({ updatedAt: -1 })
                .limit(limit * 2)
                .lean();

            for (const project of userPublicProjects) {
                const ownerId = String(project.createdBy?._id || project.createdBy);
                if (!publicProjectsByUser.has(ownerId)) {
                    publicProjectsByUser.set(ownerId, []);
                }

                publicProjectsByUser.get(ownerId).push({
                    ...toProjectSummary(project),
                    forkable: true,
                });
            }
        }

        const usersWithProjects = users.map((user) => ({
            id: String(user._id),
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl || null,
            type: "user",
            publicProjectCount: (publicProjectsByUser.get(String(user._id)) || []).length,
            publicProjects: (publicProjectsByUser.get(String(user._id)) || []).slice(0, 3),
        }));

        return res.status(200).json({
            success: true,
            users: usersWithProjects,
            projects: publicProjects.map((project) => ({
                ...toProjectSummary(project),
                forkable: true,
            })),
        });
    } catch (error) {
        return next(error);
    }
};

export const searchLinks = async (req, res, next) => {
    try {
        const { q, projectId } = req.query;
        const query = typeof q === "string" ? q.trim() : "";

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "q is required"
            });
        }

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

        const accessFilter = {
            $or: [
                { accessType: "public" },
                {
                    accessType: "role_based",
                    allowedRoles: member.roleId
                }
            ]
        };

        const results = await Link.find(
            {
                projectId,
                ...accessFilter,
                $text: { $search: query }
            },
            {
                score: { $meta: "textScore" }
            }
        )
            .limit(50)
            .populate("createdBy", "name")
            .populate("allowedRoles", "name");

        const rankedResults = results
            .map((link) => {
                const textScore = typeof link.score === "number" ? link.score : 0;
                const clickBoost = (link.clickCount || 0) * 0.3;

                const createdAt = link.createdAt ? new Date(link.createdAt) : null;
                const daysOld = createdAt && !Number.isNaN(createdAt.getTime())
                    ? (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
                    : Number.POSITIVE_INFINITY;
                const recencyBoost = Number.isFinite(daysOld)
                    ? Math.max(0, 10 - daysOld)
                    : 0;

                let statusBoost = 0;
                if (link.status === "active") {
                    statusBoost = 5;
                } else if (link.status === "decaying") {
                    statusBoost = 2;
                } else if (link.status === "dead") {
                    statusBoost = -5;
                }

                const finalScore = textScore + clickBoost + recencyBoost + statusBoost;

                return {
                    ...link.toObject(),
                    finalScore
                };
            })
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, 20);

        return res.status(200).json({
            success: true,
            results: rankedResults
        });
    } catch (error) {
        return next(error);
    }
};

export const searchSpotlight = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
        const latticeId = typeof req.query.latticeId === "string" ? req.query.latticeId.trim() : "";
        const limit = clampLimit(req.query.limit, 8, 20);

        const accessibleProjects = await Project.find({
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        })
            .select("name projectType updatedAt")
            .sort({ updatedAt: -1 })
            .lean();

        const accessibleProjectIds = accessibleProjects.map((project) => project._id);

        if (!accessibleProjectIds.length) {
            return res.status(200).json({
                success: true,
                contexts: [],
                results: [],
            });
        }

        const scopedLatticeId = latticeId && mongoose.Types.ObjectId.isValid(latticeId)
            ? new mongoose.Types.ObjectId(latticeId)
            : null;

        const projectScope = scopedLatticeId
            ? accessibleProjectIds.filter((projectId) => String(projectId) === String(scopedLatticeId))
            : accessibleProjectIds;

        const [linkCounts, nodeCounts] = await Promise.all([
            Link.aggregate([
                { $match: { projectId: { $in: accessibleProjectIds } } },
                { $group: { _id: "$projectId", count: { $sum: 1 } } },
            ]),
            LatticeNode.aggregate([
                { $match: { latticeId: { $in: accessibleProjectIds } } },
                { $group: { _id: "$latticeId", count: { $sum: 1 } } },
            ]),
        ]);

        const linkCountMap = new Map(linkCounts.map((entry) => [String(entry._id), entry.count]));
        const nodeCountMap = new Map(nodeCounts.map((entry) => [String(entry._id), entry.count]));

        const contexts = accessibleProjects.map((project) => ({
            ...toProjectSummary(project),
            links: linkCountMap.get(String(project._id)) || 0,
            nodes: nodeCountMap.get(String(project._id)) || 0,
        }));

        if (!query) {
            return res.status(200).json({
                success: true,
                contexts,
                results: [],
            });
        }

        if (!projectScope.length) {
            return res.status(200).json({
                success: true,
                contexts,
                results: [],
            });
        }

        const regexQuery = buildRegexQuery(query);

        const [linkMatches, nodeMatches, projectNameMatches] = await Promise.all([
            Link.find({
                projectId: { $in: projectScope },
                $or: [
                    { url: regexQuery },
                    { title: regexQuery },
                    { summary: regexQuery },
                    { description: regexQuery },
                    { tags: regexQuery },
                ],
            })
                .select("projectId url title summary description tags updatedAt")
                .sort({ updatedAt: -1 })
                .limit(limit)
                .lean(),
            LatticeNode.find({
                latticeId: { $in: projectScope },
                $or: [
                    { title: regexQuery },
                    { summary: regexQuery },
                    { tags: regexQuery },
                ],
            })
                .select("latticeId title summary tags importanceScore updatedAt")
                .sort({ importanceScore: -1, updatedAt: -1 })
                .limit(limit)
                .lean(),
            Project.find({
                _id: { $in: projectScope },
                name: regexQuery,
            })
                .select("name projectType updatedAt")
                .sort({ updatedAt: -1 })
                .limit(Math.min(limit, 5))
                .lean(),
        ]);

        const projectMap = new Map(accessibleProjects.map((project) => [String(project._id), project]));

        const linkResults = linkMatches.map((link) => {
            const project = projectMap.get(String(link.projectId));
            const haystack = `${link.url || ""} ${link.title || ""} ${link.summary || ""} ${link.description || ""} ${(link.tags || []).join(" ")}`.toLowerCase();
            const score = haystack.includes(query.toLowerCase()) ? 0.9 : 0.6;

            return {
                id: String(link._id),
                type: "link",
                title: link.title || link.url,
                description: link.summary || link.description || "Saved link",
                path: `${project?.name || "space"} / link`,
                url: link.url,
                tags: link.tags || [],
                updatedAt: link.updatedAt,
                project: project ? toProjectSummary(project) : null,
                score,
            };
        });

        const nodeResults = nodeMatches.map((node) => {
            const project = projectMap.get(String(node.latticeId));
            const haystack = `${node.title || ""} ${node.summary || ""} ${(node.tags || []).join(" ")}`.toLowerCase();
            const score = haystack.includes(query.toLowerCase()) ? 0.95 : 0.65;

            return {
                id: String(node._id),
                type: "node",
                title: node.title,
                description: node.summary || "Knowledge node",
                path: `${project?.name || "space"} / note`,
                tags: node.tags || [],
                updatedAt: node.updatedAt,
                project: project ? toProjectSummary(project) : null,
                score,
            };
        });

        const projectResults = projectNameMatches.map((project) => ({
            id: String(project._id),
            type: "project",
            title: project.name,
            description: project.projectType === "collaborative" ? "Shared space" : "Personal space",
            path: "Space",
            tags: [project.projectType],
            updatedAt: project.updatedAt,
            project: toProjectSummary(project),
            score: 1,
        }));

        const results = [...projectResults, ...nodeResults, ...linkResults]
            .sort((left, right) => (right.score || 0) - (left.score || 0))
            .slice(0, limit);

        return res.status(200).json({
            success: true,
            contexts,
            results,
        });
    } catch (error) {
        return next(error);
    }
};
