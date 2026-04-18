import {
    createSnapshot,
    generateTimelineInsights,
    getOrCreateMockLink,
    getHistory,
    getTimeline,
} from "../services/timelineService.js";

export async function createSnapshotController(req, res, next) {
    try {
        const link = await getOrCreateMockLink();
        const result = await createSnapshot(link);

        res.json({
            ok: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function getTimelineController(req, res, next) {
    try {
        const link = await getOrCreateMockLink();
        const events = await getTimeline(link.id);
        const timelineMeta = generateTimelineInsights(events, link?.last_viewed_at || null);

        res.json({
            ok: true,
            count: events.length,
            data: events,
            events,
            insights: timelineMeta.insights,
            since_last_seen: timelineMeta.since_last_seen,
            compressed_events: timelineMeta.compressed_events,
        });
    } catch (error) {
        next(error);
    }
}

export async function getHistoryController(req, res, next) {
    try {
        const link = await getOrCreateMockLink();
        const snapshots = await getHistory(link.id);

        res.json({
            ok: true,
            count: snapshots.length,
            data: snapshots,
        });
    } catch (error) {
        next(error);
    }
}
