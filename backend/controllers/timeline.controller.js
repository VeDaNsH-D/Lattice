import {
    createSnapshot,
    ensureTimelineLink,
    generateTimelineInsights,
    getOrCreateMockLink,
    getHistory,
    getTimeline,
} from "../services/timelineService.js";

async function resolveTimelineLinkFromRequest(req) {
    const queryLinkId = String(req?.query?.linkId || "").trim();
    const queryUrl = String(req?.query?.url || "").trim();
    const queryTitle = String(req?.query?.title || "").trim();

    if (queryLinkId || queryUrl) {
        return ensureTimelineLink({
            id: queryLinkId || undefined,
            url: queryUrl || undefined,
            title: queryTitle || undefined,
        });
    }

    return getOrCreateMockLink();
}

export async function createSnapshotController(req, res, next) {
    try {
        const link = await resolveTimelineLinkFromRequest(req);
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
        const link = await resolveTimelineLinkFromRequest(req);
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
        const link = await resolveTimelineLinkFromRequest(req);
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
