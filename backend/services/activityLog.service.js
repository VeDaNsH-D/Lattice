import ActivityLog from "../models/activityLog.js";

export async function recordActivity({ projectId, actorId, type, payload = {} }) {
    if (!projectId || !actorId || !type) {
        return null;
    }

    try {
        return await ActivityLog.create({
            projectId,
            actorId,
            type,
            payload,
        });
    } catch (error) {
        console.error("Activity log write failed:", error.message);
        return null;
    }
}
