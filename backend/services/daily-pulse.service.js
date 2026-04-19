import fs from "fs/promises";
import os from "os";
import path from "path";
import Project from "../models/project.js";
import ActivityLog from "../models/activityLog.js";
import { generateDailyPulseScript, synthesizeSpeechToFile } from "./ai.client.js";

const DEFAULT_WINDOW_HOURS = 24;

const ACTIVITY_LABELS = {
    link_added: "added a link",
    link_deleted: "deleted a link",
    link_restored: "restored a link",
    comment_added: "added a comment",
    comment_resolved: "resolved a comment",
    bookmarks_imported: "imported bookmarks",
    project_created: "created the project",
    role_created: "created a role",
    collaborator_invited: "invited a collaborator",
    collaborator_added: "added a collaborator",
    reaction_updated: "updated reactions",
    collaborator_joined_room: "joined the room",
    collaborator_sent_chat: "sent a chat message",
    forked_by_you: "forked the project",
};

const safeTrim = (value) => String(value || "").trim();

const createTempAudioPath = (projectId) => {
    const name = `pulse-${safeTrim(projectId)}-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`;
    return path.join(os.tmpdir(), name);
};

const formatActivityForScript = (log) => {
    const label = ACTIVITY_LABELS[log.type] || log.type.replace(/_/g, " ");
    const actorName = log.actorId?.name || "Someone";
    const linkTitle = log.payload?.title || log.payload?.projectName || log.payload?.sourceProjectName || "";

    if (log.type === "link_added" && linkTitle) {
        return `${actorName} ${label} titled ${linkTitle}.`;
    }

    if ((log.type === "comment_added" || log.type === "comment_resolved" || log.type === "reaction_updated") && linkTitle) {
        return `${actorName} ${label} on ${linkTitle}.`;
    }

    if (log.type === "forked_by_you" && linkTitle) {
        return `${actorName} forked ${linkTitle}.`;
    }

    if (log.type === "collaborator_invited" || log.type === "collaborator_added") {
        return `${actorName} ${label}.`;
    }

    if (linkTitle) {
        return `${actorName} ${label} for ${linkTitle}.`;
    }

    return `${actorName} ${label}.`;
};

export async function buildDailyPulse({ projectId, userId, hours = DEFAULT_WINDOW_HOURS }) {
    const project = await Project.findOne({
        _id: projectId,
        isActive: true,
        $or: [{ createdBy: userId }, { members: userId }],
    }).select("_id name projectType createdBy members").lean();

    if (!project) {
        const error = new Error("Project not found");
        error.status = 404;
        throw error;
    }

    const windowHours = Number.isFinite(Number(hours)) ? Math.min(Math.max(Number(hours), 1), 72) : DEFAULT_WINDOW_HOURS;
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const logs = await ActivityLog.find({
        projectId: project._id,
        createdAt: { $gte: windowStart },
    })
        .populate("actorId", "name avatarUrl")
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();

    const narratedLines = logs.map(formatActivityForScript).filter(Boolean).slice(0, 12);
    const linkCount = logs.filter((log) => log.type === "link_added").length;

    const summaries = narratedLines.length > 0
        ? narratedLines
        : ["No major project activity was recorded in the last 24 hours."];

    const script = await generateDailyPulseScript({
        projectName: project.name,
        linkCount,
        summaries,
    });

    return {
        project,
        windowHours,
        windowStart,
        logCount: logs.length,
        linkCount,
        summaries,
        script: String(script || "").trim(),
    };
}

export async function generateDailyPulseAudioFile({ projectId, userId, hours = DEFAULT_WINDOW_HOURS }) {
    const pulse = await buildDailyPulse({ projectId, userId, hours });
    const outputFilePath = createTempAudioPath(projectId);

    await synthesizeSpeechToFile({
        text: pulse.script,
        outputFilePath,
    });

    return {
        ...pulse,
        outputFilePath,
    };
}

export async function cleanupAudioFile(filePath) {
    if (!filePath) {
        return;
    }

    try {
        await fs.unlink(filePath);
    } catch {
        // Ignore cleanup errors.
    }
}

export function scheduleDailyPulseJob() {
    console.log('Daily pulse job scheduling skipped in local bootstrap.');
}
