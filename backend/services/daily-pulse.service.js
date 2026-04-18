import cron from "node-cron";
import path from "path";

import DailyPulse from "../models/dailyPulse.js";
import Link from "../models/link.js";
import Project from "../models/project.js";
import {
    generateDailyPulseScript,
    summarizeLinkToThreeSentences,
    synthesizeSpeechToFile
} from "./ai.client.js";

const DAILY_PULSE_CRON = process.env.DAILY_PULSE_CRON || "0 9 * * *";
const DAILY_PULSE_TIMEZONE = process.env.DAILY_PULSE_TIMEZONE || "Asia/Kolkata";
const AUDIO_BASE_DIR = path.join(process.cwd(), "generated", "daily-pulse");

let isRunning = false;

function getRunDate(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function buildPublicBaseUrl(explicitBaseUrl) {
    if (explicitBaseUrl) {
        return explicitBaseUrl;
    }

    if (process.env.PUBLIC_BASE_URL) {
        return process.env.PUBLIC_BASE_URL;
    }

    const port = process.env.PORT || 8000;
    return `http://localhost:${port}`;
}

function estimateDurationSeconds(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const wordsPerMinute = 145;

    return Math.max(20, Math.round((words / wordsPerMinute) * 60));
}

async function ensureThreeSentenceSummary(link) {
    if (link.summary) {
        return link.summary;
    }

    const summary = await summarizeLinkToThreeSentences(link);
    await Link.updateOne({ _id: link._id }, { $set: { summary } });

    return summary;
}

export async function generateDailyPulseForProject(projectId, options = {}) {
    const now = options.now || new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [project, links] = await Promise.all([
        Project.findById(projectId),
        Link.find({
            projectId,
            createdAt: { $gte: since, $lte: now }
        }).sort({ createdAt: 1 })
    ]);

    if (!links.length) {
        return {
            projectId,
            created: false,
            reason: "No links were added in the last 24 hours."
        };
    }

    const summaries = [];

    for (const link of links) {
        const summary = await ensureThreeSentenceSummary(link);
        summaries.push(summary);
    }

    const script = await generateDailyPulseScript({
        projectName: project?.name,
        linkCount: links.length,
        summaries
    });

    const dayKey = now.toISOString().slice(0, 10);
    const fileName = `${dayKey}.mp3`;
    const relativeAudioPath = path.join("daily-pulse", String(projectId), fileName);
    const absoluteAudioPath = path.join(AUDIO_BASE_DIR, String(projectId), fileName);

    await synthesizeSpeechToFile({
        text: script,
        outputFilePath: absoluteAudioPath
    });

    const baseUrl = buildPublicBaseUrl(options.baseUrl);
    const audioUrl = `${baseUrl}/media/${relativeAudioPath.replaceAll("\\\\", "/")}`;

    const payload = {
        sourceLinkIds: links.map((link) => link._id),
        script,
        audioPath: relativeAudioPath,
        audioUrl,
        durationSec: estimateDurationSeconds(script),
        status: "ready",
        errorMessage: undefined
    };

    const pulse = await DailyPulse.findOneAndUpdate(
        {
            projectId,
            runDate: getRunDate(now)
        },
        {
            $set: payload
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    );

    return {
        projectId,
        created: true,
        pulse
    };
}

export async function generateDailyPulseForAllProjects(options = {}) {
    const now = options.now || new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const projectIds = await Link.distinct("projectId", {
        createdAt: { $gte: since, $lte: now }
    });

    const results = [];

    for (const projectId of projectIds) {
        try {
            const result = await generateDailyPulseForProject(projectId, options);
            results.push({ success: true, ...result });
        } catch (error) {
            const runDate = getRunDate(now);

            await DailyPulse.findOneAndUpdate(
                { projectId, runDate },
                {
                    $set: {
                        script: "",
                        sourceLinkIds: [],
                        audioPath: "",
                        audioUrl: "",
                        status: "failed",
                        errorMessage: error.message
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            results.push({
                success: false,
                projectId,
                error: error.message
            });
        }
    }

    return results;
}

export function scheduleDailyPulseJob() {
    if (!cron.validate(DAILY_PULSE_CRON)) {
        throw new Error(`Invalid DAILY_PULSE_CRON expression: ${DAILY_PULSE_CRON}`);
    }

    return cron.schedule(
        DAILY_PULSE_CRON,
        async () => {
            if (isRunning) {
                return;
            }

            isRunning = true;

            try {
                const results = await generateDailyPulseForAllProjects();
                console.log("Daily pulse run completed:", results.length, "projects processed.");
            } catch (error) {
                console.error("Daily pulse run failed:", error);
            } finally {
                isRunning = false;
            }
        },
        {
            timezone: DAILY_PULSE_TIMEZONE
        }
    );
}
