import TimelineLinkModel from "../models/TimelineLink.js";
import EventModel from "../models/Event.js";
import SnapshotModel from "../models/Snapshot.js";
import { detectChange } from "./changeDetectionService.js";
import { fetchPageContent } from "./scraperService.js";
import { fetchSearchContext } from "./searchService.js";
import { generateSummary } from "./summaryService.js";

const MOCK_LINK_URL = "https://en.wikipedia.org/wiki/Artificial_intelligence";
const MOCK_LINK_TITLE = "Test Link";

function mapLink(linkDoc) {
    if (!linkDoc) {
        return null;
    }

    return {
        id: String(linkDoc._id),
        url: linkDoc.url,
        title: linkDoc.title,
        created_at: linkDoc.created_at ? new Date(linkDoc.created_at).toISOString() : null,
        last_viewed_at: linkDoc.last_viewed_at ? new Date(linkDoc.last_viewed_at).toISOString() : null,
    };
}

function mapSnapshot(snapshotDoc) {
    if (!snapshotDoc) {
        return null;
    }

    return {
        id: String(snapshotDoc._id),
        link_id: String(snapshotDoc.link_id),
        timestamp: snapshotDoc.timestamp ? new Date(snapshotDoc.timestamp).toISOString() : null,
        summary: snapshotDoc.summary,
        page_summary: snapshotDoc.page_summary || "",
        context_summary: snapshotDoc.context_summary || "",
        summary_engine: snapshotDoc.summary_engine || "legacy",
        change_level: snapshotDoc.change_level,
    };
}

function mapEvent(eventDoc) {
    if (!eventDoc) {
        return null;
    }

    return {
        id: String(eventDoc._id),
        link_id: String(eventDoc.link_id),
        timestamp: eventDoc.timestamp ? new Date(eventDoc.timestamp).toISOString() : null,
        type: eventDoc.type,
        description: eventDoc.description,
        source: eventDoc.source || "page",
    };
}

function compactSignalText(value, maxChars = 320) {
    const cleaned = String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    if (cleaned.length <= maxChars) {
        return cleaned;
    }

    return `${cleaned.slice(0, maxChars - 3).trim()}...`;
}

function extractKeywordFromUrl(url) {
    try {
        const parts = String(url || "").split("/");
        const lastPart = parts[parts.length - 1] || "";

        return lastPart
            .replace(/[-_]/g, " ")
            .replace(/\?.*/, "")
            .trim();
    } catch (error) {
        return "";
    }
}

function buildSearchQuery(link) {
    let query = "";

    if (link?.title && link.title !== "Test Link") {
        query = link.title;
    } else {
        query = extractKeywordFromUrl(link?.url);
    }

    if (!query) {
        query = "technology";
    }

    return query;
}

export async function getOrCreateMockLink() {
    const linkDoc = await TimelineLinkModel.findOneAndUpdate(
        { url: MOCK_LINK_URL },
        {
            $setOnInsert: {
                url: MOCK_LINK_URL,
                title: MOCK_LINK_TITLE,
            },
        },
        {
            returnDocument: "after",
            upsert: true,
            setDefaultsOnInsert: true,
        }
    ).lean();

    return mapLink(linkDoc);
}

async function resolveLinkDoc(link) {
    if (link?.id) {
        const byId = await TimelineLinkModel.findById(link.id).lean();
        if (byId) {
            return byId;
        }
    }

    if (link?.url) {
        const byUrl = await TimelineLinkModel.findOneAndUpdate(
            { url: link.url },
            {
                $setOnInsert: {
                    url: link.url,
                    title: link.title || MOCK_LINK_TITLE,
                },
            },
            {
                returnDocument: "after",
                upsert: true,
                setDefaultsOnInsert: true,
            }
        ).lean();

        if (byUrl) {
            return byUrl;
        }
    }

    return TimelineLinkModel.findOneAndUpdate(
        { url: MOCK_LINK_URL },
        {
            $setOnInsert: {
                url: MOCK_LINK_URL,
                title: MOCK_LINK_TITLE,
            },
        },
        {
            returnDocument: "after",
            upsert: true,
            setDefaultsOnInsert: true,
        }
    ).lean();
}

export async function ensureTimelineLink(link = null) {
    const linkDoc = await resolveLinkDoc(link);
    return mapLink(linkDoc);
}

export async function createSnapshot(link = null) {
    const linkDoc = await resolveLinkDoc(link);

    if (!linkDoc) {
        throw new Error("No link available for snapshot creation.");
    }

    const mappedLink = mapLink(linkDoc);

    // 1) Fetch latest page content from Playwright.
    let pageContent = "";
    try {
        pageContent = await fetchPageContent(mappedLink.url);
    } catch (error) {
        pageContent = "";
    }

    // 2) Fetch related context from DuckDuckGo Instant Answer API.
    let searchContext = "";
    try {
        searchContext = await fetchSearchContext(buildSearchQuery(mappedLink));
    } catch (error) {
        searchContext = "";
    }

    const fullPageSignal = pageContent || mappedLink.title || mappedLink.url;
    const fullContextSignal = searchContext || "";
    const pageSummaryInput = compactSignalText(fullPageSignal);
    const contextSummaryInput = compactSignalText(fullContextSignal);

    // 3) Build a concise summary from page + search signals.
    const summary = await generateSummary(fullPageSignal, fullContextSignal);

    // 4) Compare only against previous overtime snapshots so ingestion summaries
    // do not create false change events.
    const previousSnapshot = await SnapshotModel.findOne({
        link_id: linkDoc._id,
        summary_engine: "overtime",
    })
        .sort({ timestamp: -1 })
        .lean();
    const change = previousSnapshot
        ? await detectChange(previousSnapshot?.summary, summary, {
            old_page_summary: previousSnapshot?.page_summary,
            new_page_summary: pageSummaryInput,
            old_context_summary: previousSnapshot?.context_summary,
            new_context_summary: contextSummaryInput,
        })
        : {
            level: "none",
            reason: "overtime baseline established",
            source: "page",
        };

    // 5) Persist the snapshot in MongoDB.
    const snapshotDoc = await SnapshotModel.create({
        link_id: linkDoc._id,
        summary,
        page_summary: pageSummaryInput,
        context_summary: contextSummaryInput,
        summary_engine: "overtime",
        change_level: change.level,
    });
    const snapshot = mapSnapshot(snapshotDoc);

    // Update link metadata in MongoDB.
    const updatedLinkDoc = await TimelineLinkModel.findByIdAndUpdate(
        linkDoc._id,
        { last_viewed_at: snapshotDoc.timestamp },
        { returnDocument: "after" }
    ).lean();
    const updatedLink = mapLink(updatedLinkDoc || linkDoc);

    let event = null;

    // 6) Create compressed timeline events only for minor/major updates.
    if (change.level !== "none") {
        const eventSource = change.source || change.change_source || "page";

        const eventDoc = await EventModel.create({
            link_id: linkDoc._id,
            timestamp: snapshotDoc.timestamp,
            type: change.level,
            description: change.reason,
            source: eventSource,
        });

        event = mapEvent(eventDoc);
    }

    return {
        link: updatedLink,
        snapshot,
        event,
        meta: {
            previous_snapshot_id: previousSnapshot?._id ? String(previousSnapshot._id) : null,
            change_reason: change.reason,
            page_content_length: pageContent.length,
            search_context_length: searchContext.length,
        },
    };
}

export async function getTimeline(linkId = null) {
    const resolvedLinkId = linkId || (await getOrCreateMockLink())?.id;

    if (!resolvedLinkId) {
        return [];
    }

    const eventDocs = await EventModel.find({ link_id: resolvedLinkId })
        .sort({ timestamp: -1 })
        .lean();

    return eventDocs.map(mapEvent);
}

function toTimestamp(value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function compressTimelineEvents(events = []) {
    const compressed = [];
    let minorBuffer = [];

    const flushMinorBuffer = () => {
        if (minorBuffer.length === 0) {
            return;
        }

        if (minorBuffer.length === 1) {
            compressed.push(minorBuffer[0]);
        } else {
            compressed.push({
                id: `group_${minorBuffer[0].id}`,
                link_id: minorBuffer[0].link_id,
                timestamp: minorBuffer[minorBuffer.length - 1].timestamp,
                type: "minor",
                description: `Multiple minor updates (${minorBuffer.length})`,
                grouped: true,
                grouped_count: minorBuffer.length,
            });
        }

        minorBuffer = [];
    };

    for (const event of events) {
        if (event?.type === "minor") {
            minorBuffer.push(event);
            continue;
        }

        flushMinorBuffer();
        compressed.push(event);
    }

    flushMinorBuffer();

    return compressed;
}

// Builds UI-friendly timeline analytics without altering stored events.
export function generateTimelineInsights(events = [], lastViewedAt = null) {
    const safeEvents = Array.isArray(events) ? events : [];
    const totalChanges = safeEvents.length;
    const majorChanges = safeEvents.filter((event) => event?.type === "major").length;
    const minorChanges = safeEvents.filter((event) => event?.type === "minor").length;

    let trend = "stable";
    if (majorChanges >= 3) {
        trend = "rapid evolution";
    } else if (majorChanges >= 1) {
        trend = "evolving";
    }

    const lastSeenTs = toTimestamp(lastViewedAt);
    const recentEvents =
        lastSeenTs === null
            ? safeEvents
            : safeEvents.filter((event) => {
                const eventTs = toTimestamp(event?.timestamp);
                return eventTs !== null && eventTs > lastSeenTs;
            });

    const sinceLastSeen = {
        major: recentEvents.filter((event) => event?.type === "major").length,
        minor: recentEvents.filter((event) => event?.type === "minor").length,
    };

    return {
        insights: {
            total_changes: totalChanges,
            major_changes: majorChanges,
            minor_changes: minorChanges,
            trend,
        },
        since_last_seen: sinceLastSeen,
        compressed_events: compressTimelineEvents(safeEvents),
    };
}

export async function getHistory(linkId = null) {
    const resolvedLinkId = linkId || (await getOrCreateMockLink())?.id;

    if (!resolvedLinkId) {
        return [];
    }

    const snapshotDocs = await SnapshotModel.find({ link_id: resolvedLinkId })
        .sort({ timestamp: -1 })
        .lean();

    return snapshotDocs.map(mapSnapshot);
}
