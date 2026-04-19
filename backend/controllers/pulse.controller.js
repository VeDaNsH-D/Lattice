import { generateDailyPulseAudioFile, cleanupAudioFile } from "../services/daily-pulse.service.js";

export async function getProjectPodcastController(req, res, next) {
    let outputFilePath = null;

    try {
        const { projectId } = req.params;
        const hours = Number(req.query.hours || 24);
        const userId = req.user.userId;

        const result = await generateDailyPulseAudioFile({ projectId, userId, hours });
        outputFilePath = result.outputFilePath;

        const fileName = `${result.project.name || "project"}-${result.windowHours}h-pulse.wav`
            .replace(/[^a-z0-9\-_ ]/gi, "")
            .replace(/\s+/g, "-")
            .toLowerCase();

        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Cache-Control", "no-store");

        return res.download(outputFilePath, fileName, async (downloadError) => {
            await cleanupAudioFile(outputFilePath);
            if (downloadError && !res.headersSent) {
                next(downloadError);
            }
        });
    } catch (error) {
        if (outputFilePath) {
            await cleanupAudioFile(outputFilePath);
        }
        return next(error);
    }
}
