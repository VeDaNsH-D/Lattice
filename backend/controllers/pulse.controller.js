import fs from "fs/promises";
import path from "path";
import DailyPulse from "../models/dailyPulse.js";
import { generateDailyPulseForProject } from "../services/daily-pulse.service.js";

export const runDailyPulseNow = async (req, res, next) => {
    try {
        const { projectId } = req.body;
        const result = await generateDailyPulseForProject(projectId);

        return res.status(200).json({
            success: true,
            result
        });
    } catch (error) {
        return next(error);
    }
};

export const getLatestProjectPulse = async (req, res, next) => {
    try {
        const { projectId } = req.query;

        const pulse = await DailyPulse.findOne({ projectId, status: "ready" })
            .sort({ runDate: -1 })
            .populate("sourceLinkIds", "url title summary");

        if (!pulse) {
            return res.status(404).json({
                success: false,
                message: "No pulse found for this project."
            });
        }

        return res.status(200).json({
            success: true,
            pulse
        });
    } catch (error) {
        return next(error);
    }
};

export const listProjectPulses = async (req, res, next) => {
    try {
        const { projectId } = req.query;

        const pulses = await DailyPulse.find({ projectId })
            .sort({ runDate: -1 })
            .limit(30)
            .select("runDate audioUrl durationSec status errorMessage createdAt");

        return res.status(200).json({
            success: true,
            count: pulses.length,
            pulses
        });
    } catch (error) {
        return next(error);
    }
};

export const downloadLatestProjectPulse = async (req, res, next) => {
    try {
        const { projectId } = req.query;

        const pulse = await DailyPulse.findOne({ projectId, status: "ready" }).sort({ runDate: -1 });

        if (!pulse) {
            return res.status(404).json({
                success: false,
                message: "No downloadable pulse found for this project."
            });
        }

        const absoluteAudioPath = path.join(process.cwd(), "generated", pulse.audioPath);

        try {
            await fs.access(absoluteAudioPath);
        } catch {
            return res.status(404).json({
                success: false,
                message: "Pulse audio file does not exist on disk."
            });
        }

        const dateLabel = pulse.runDate instanceof Date
            ? pulse.runDate.toISOString().slice(0, 10)
            : "latest";

        const fileName = `daily-pulse-${projectId}-${dateLabel}.mp3`;

        return res.download(absoluteAudioPath, fileName);
    } catch (error) {
        return next(error);
    }
};
