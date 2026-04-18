import Project from "../models/project.js";
import Bookmark from "../models/link.js";
import mongoose from "mongoose";

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

function buildBookmarkDocument({ projectId, url, title, userId }) {
    const document = {
        projectId,
        url,
        title: typeof title === "string" ? title.trim() : "",
    };

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

export async function importBookmarks(req, res) {
    try {
        const { projectId, bookmarks, tree } = req.body || {};
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

        const project = await Project.findById(projectId).select("_id");
        if (!project) {
            return res.status(404).json({
                message: "Project not found",
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
            }));

        if (toInsert.length > 0) {
            await Bookmark.insertMany(toInsert, { ordered: false });

            // Optional: enqueue background bookmark processing job here if queue is available.
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
