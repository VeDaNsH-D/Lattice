import { createChatCompletion } from "./ai.client.js";

const FALLBACK_TAGS = ["general"];

function safeParseJson(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export async function generateAIContent(title = "", description = "", url = "") {
    const compactTitle = String(title || "").trim();
    const compactDescription = String(description || "").trim();
    const compactUrl = String(url || "").trim();

    if (!compactTitle && !compactDescription && !compactUrl) {
        return {
            summary: null,
            tags: FALLBACK_TAGS,
            vibe: null,
            parentHub: "General"
        };
    }

    const systemPrompt = [
        "You generate concise metadata for saved links in a knowledge workspace.",
        "Return strict JSON with keys: summary, tags, vibe, parentHub.",
        "summary should be max 2 short sentences.",
        "tags should be an array of up to 5 lowercase strings.",
        "vibe should be one short lowercase phrase.",
        "parentHub must be a dynamic but highly generalized category clustering name (e.g., 'Machine Learning', 'Frontend Engineering', 'Social Media', 'Design Resources', 'Investments'). If the url clearly points to Reddit or Twitter, group it natively like 'Reddit Discussions' or 'Twitter Threads' respectively, but don't hardcode rules—intelligently group based on standard thematic groupings."
    ].join(" ");

    const userPrompt = [
        `URL: ${compactUrl}`,
        `Title: ${compactTitle}`,
        `Description: ${compactDescription}`
    ].join("\n");

    try {
        const content = await createChatCompletion({
            systemPrompt,
            userPrompt,
            responseFormat: { type: "json_object" },
            temperature: 0.2,
            maxTokens: 220
        });

        const parsed = safeParseJson(content) || {};
        const tags = Array.isArray(parsed.tags)
            ? parsed.tags
                .map((tag) => String(tag).trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 5)
            : [];

        return {
            summary: typeof parsed.summary === "string" ? parsed.summary.trim() || null : null,
            tags: tags.length ? tags : FALLBACK_TAGS,
            vibe: typeof parsed.vibe === "string" ? parsed.vibe.trim() || null : null,
            parentHub: typeof parsed.parentHub === "string" ? parsed.parentHub.trim() : "General"
        };
    } catch {
        return {
            summary: null,
            tags: FALLBACK_TAGS,
            vibe: null,
            parentHub: "General"
        };
    }
}
