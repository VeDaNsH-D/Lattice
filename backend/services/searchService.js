const DUCKDUCKGO_ENDPOINT = "https://api.duckduckgo.com/";
const MAX_CONTEXT_CHARS = 500;

function normalizeText(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}

function extractKeywordFromUrl(value) {
    try {
        const parsed = new URL(value);
        const segments = decodeURIComponent(parsed.pathname || "")
            .split("/")
            .map((segment) => segment.trim())
            .filter(Boolean);

        const preferredSegment = segments.length > 0 ? segments[segments.length - 1] : "";

        const fromPath = preferredSegment
            .replace(/\.[a-z0-9]+$/i, "")
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (fromPath) {
            return fromPath;
        }

        return normalizeText(parsed.hostname.replace(/^www\./i, "").replace(/\./g, " "));
    } catch (error) {
        return "";
    }
}

function normalizeDuckDuckGoQuery(query) {
    const raw = normalizeText(query);
    const lowered = raw.toLowerCase();

    // If the title is generic, try extracting useful keywords from URL-form input.
    if (!raw || lowered === "test link") {
        const extracted = extractKeywordFromUrl(raw);
        return extracted || raw;
    }

    const fromUrl = extractKeywordFromUrl(raw);
    return fromUrl || raw;
}

function extractDuckDuckGoText(data) {
    // 1. Abstract
    if (data?.AbstractText && data.AbstractText.length > 20) {
        return data.AbstractText;
    }

    // 2. RelatedTopics (flat + nested)
    if (Array.isArray(data?.RelatedTopics) && data.RelatedTopics.length > 0) {
        for (const topic of data.RelatedTopics) {
            // direct text
            if (topic?.Text) {
                return topic.Text;
            }

            // nested topics
            if (Array.isArray(topic?.Topics) && topic.Topics.length > 0) {
                for (const sub of topic.Topics) {
                    if (sub?.Text) {
                        return sub.Text;
                    }
                }
            }
        }
    }

    return "";
}

export async function fetchSearchContext(query) {
    try {
        const safeQuery = normalizeDuckDuckGoQuery(query);

        if (!safeQuery) {
            return "No additional context available";
        }

        const params = new URLSearchParams({
            q: safeQuery,
            format: "json",
            no_html: "1",
        });

        const response = await fetch(`${DUCKDUCKGO_ENDPOINT}?${params.toString()}`);

        if (!response.ok) {
            return "No additional context available";
        }

        const data = await response.json();
        const text = normalizeText(extractDuckDuckGoText(data));

        // Temporary debugging logs for query/extraction verification.
        console.log("DDG QUERY:", safeQuery);
        console.log("DDG RAW:", data);
        console.log("EXTRACTED CONTEXT:", text);

        if (!text) {
            return "No additional context available";
        }

        return text.slice(0, MAX_CONTEXT_CHARS);
    } catch (error) {
        // Search context is auxiliary; failures should not break snapshot creation.
        return "No additional context available";
    }
}
