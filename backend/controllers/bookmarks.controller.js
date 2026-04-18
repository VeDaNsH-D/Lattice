import Project from "../models/project.js";
import Bookmark from "../models/link.js";
import mongoose from "mongoose";
import { fetchMetadata } from "../services/metadata.service.js";
import { generateAIContent } from "../services/ai.service.js";
import { ensureLinkEnrichment, processNewLinkForCollision } from "../services/link-intelligence.service.js";
import { buildGraphNode } from "../services/graph.service.js";
import { recordActivity } from "../services/activityLog.service.js";
import { resolveVibe } from "../utils/vibe.js";

function normalizeBookmarkUrl(rawUrl) {
    try {
        const parsed = new URL(String(rawUrl || "").trim());
        parsed.hash = "";
        parsed.search = "";

        const normalizedPathname = parsed.pathname.endsWith("/") && parsed.pathname !== "/"
            ? parsed.pathname.slice(0, -1)
            : parsed.pathname;

        return `${parsed.origin}${normalizedPathname || "/"}`;
    } catch (error) {
        return null;
    }
}

function extractBookmarksFromTree(tree) {
    const extracted = [];

    function walk(nodes) {
        if (!Array.isArray(nodes)) {
            return;
        }

        for (const node of nodes) {
            if (node?.url) {
                extracted.push({
                    url: node.url,
                    title: typeof node.title === "string" ? node.title : "",
                });
            }

            if (Array.isArray(node?.children) && node.children.length > 0) {
                walk(node.children);
            }
        }
    }

    walk(tree);
    return extracted;
}

function buildBookmarkDocument({ projectId, url, title, userId, accessType, allowedRoles }) {
    const document = {
        projectId,
        url,
        title: typeof title === "string" ? title.trim() : "",
    };

    if (Bookmark.schema.path("accessType") && ["public", "role_based"].includes(accessType)) {
        document.accessType = accessType;
    }

    if (Bookmark.schema.path("allowedRoles")) {
        const normalizedAllowedRoles = Array.isArray(allowedRoles) ? allowedRoles.filter(Boolean) : [];
        document.allowedRoles = document.accessType === "role_based" ? normalizedAllowedRoles : [];
    }

    if (Bookmark.schema.path("source")) {
        document.source = "chrome_import";
    }

    if (Bookmark.schema.path("importedBy")) {
        document.importedBy = userId;
    } else if (Bookmark.schema.path("createdBy")) {
        document.createdBy = userId;
    }

    const statusPath = Bookmark.schema.path("status");
    if (statusPath) {
        const enumValues = Array.isArray(statusPath.enumValues) ? statusPath.enumValues : [];
        if (enumValues.includes("pending")) {
            document.status = "pending";
        }
    }

    return document;
}

async function enrichImportedBookmark(linkId) {
    try {
        const existingLink = await Bookmark.findById(linkId);
        if (!existingLink) {
            return;
        }

        const metadata = await fetchMetadata(existingLink.url);
        const resolvedTitle = existingLink.title || metadata.title || existingLink.url;
        const resolvedDescription = existingLink.description || metadata.description || null;
        const resolvedImage = existingLink.image || metadata.image || null;

        const updates = {
            title: resolvedTitle,
            description: resolvedDescription,
            image: resolvedImage,
        };

        const needsTags = !Array.isArray(existingLink.tags) || existingLink.tags.length === 0;
        const needsVibe = !existingLink.vibe;

        if (needsTags || needsVibe) {
            const aiContent = await generateAIContent(resolvedTitle, resolvedDescription);

            if (needsTags && Array.isArray(aiContent.tags) && aiContent.tags.length > 0) {
                updates.tags = aiContent.tags;
            }

            if (needsVibe && aiContent.vibe) {
                updates.vibe = resolveVibe(aiContent.vibe, {
                    title: resolvedTitle,
                    description: resolvedDescription,
                    url: existingLink.url,
                    tags: updates.tags || existingLink.tags || [],
                    parentHub: existingLink.parentHub
                });
            }
        }

        await Bookmark.updateOne({ _id: linkId }, { $set: updates });

        const enrichedLink = await Bookmark.findById(linkId);
        if (!enrichedLink) {
            return;
        }

        await ensureLinkEnrichment(enrichedLink);
        await processNewLinkForCollision(enrichedLink);
        await buildGraphNode({
            _id: enrichedLink._id,
            title: enrichedLink.title || enrichedLink.url,
            summary: enrichedLink.summary || enrichedLink.description || "",
            tags: enrichedLink.tags || [],
            embedding: enrichedLink.embedding,
            latticeId: enrichedLink.projectId,
        });
    } catch (error) {
        console.error("Imported bookmark enrichment failed:", error.message);
    }
}

export async function importBookmarks(req, res) {
    try {
        const { projectId, bookmarks, tree, accessType, allowedRoles } = req.body || {};
        const userId = req.user?.id || req.user?.userId;
        const hasBookmarks = Array.isArray(bookmarks);
        const hasTree = Array.isArray(tree);

        if (!projectId) {
            return res.status(400).json({
                message: "projectId is required",
            });
        }

        if (!hasBookmarks && !hasTree) {
            return res.status(400).json({
                message: "Either bookmarks array or tree is required",
            });
        }

        const bookmarksToImport = hasTree ? extractBookmarksFromTree(tree) : bookmarks;

        if (!Array.isArray(bookmarksToImport) || bookmarksToImport.length === 0) {
            return res.status(400).json({
                message: "bookmarks array cannot be empty",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                message: "Invalid projectId",
            });
        }

        const project = await Project.findOne({
            _id: projectId,
            isActive: true,
            $or: [{ createdBy: userId }, { members: userId }],
        }).select("_id");
        if (!project) {
            return res.status(403).json({
                message: "Forbidden: you do not have access to this project",
            });
        }

        if (accessType === "role_based" && (!Array.isArray(allowedRoles) || allowedRoles.length === 0)) {
            return res.status(400).json({
                message: "allowedRoles is required when accessType is role_based",
            });
        }

        const normalizedIncoming = bookmarksToImport
            .map((item) => ({
                url: normalizeBookmarkUrl(item?.url),
                title: item?.title,
            }))
            .filter((item) => item.url);

        if (normalizedIncoming.length === 0) {
            return res.status(400).json({
                message: "No valid bookmark URLs provided",
            });
        }

        const uniqueIncomingMap = new Map();
        for (const item of normalizedIncoming) {
            if (!uniqueIncomingMap.has(item.url)) {
                uniqueIncomingMap.set(item.url, item);
            }
        }

        const uniqueIncoming = Array.from(uniqueIncomingMap.values());
        const uniqueUrls = uniqueIncoming.map((item) => item.url);

        const existingBookmarks = await Bookmark.find({
            projectId,
            url: { $in: uniqueUrls },
        })
            .select("url")
            .lean();

        const existingUrlSet = new Set(existingBookmarks.map((item) => item.url));
        const toInsert = uniqueIncoming
            .filter((item) => !existingUrlSet.has(item.url))
            .map((item) => buildBookmarkDocument({
                projectId,
                url: item.url,
                title: item.title,
                userId,
                accessType,
                allowedRoles,
            }));

        if (toInsert.length > 0) {
            const insertedBookmarks = await Bookmark.insertMany(toInsert, { ordered: false });

            await recordActivity({
                projectId,
                actorId: userId,
                type: "bookmarks_imported",
                payload: {
                    importedCount: insertedBookmarks.length,
                    skippedCount: bookmarksToImport.length - toInsert.length,
                },
            });

            setImmediate(() => {
                Promise.allSettled(insertedBookmarks.map((item) => enrichImportedBookmark(item._id)))
                    .catch((error) => {
                        console.error("Imported bookmark background pipeline failed:", error.message);
                    });
            });
        }

        return res.status(200).json({
            message: "Import completed",
            imported: toInsert.length,
            skipped: bookmarksToImport.length - toInsert.length,
        });
    } catch (error) {
        console.error("Bookmark import failed:", error);
        return res.status(500).json({
            message: "Server error",
        });
    }
}
