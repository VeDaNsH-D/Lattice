import { createChatCompletion } from "./ai.client.js";

const FALLBACK_TAGS = ["general"];

function safeParseJson(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export async function generateAIContent(title = "", description = "") {
    const compactTitle = String(title || "").trim();
    const compactDescription = String(description || "").trim();

    if (!compactTitle && !compactDescription) {
        return {
            summary: null,
            tags: FALLBACK_TAGS,
            vibe: null
        };
    }

    const systemPrompt = [
        "You generate concise metadata for saved links in a knowledge workspace.",
        "Return strict JSON with keys: summary, tags, vibe.",
        "summary should be max 2 short sentences.",
        "tags should be an array of up to 5 lowercase strings.",
        "vibe should be one short lowercase phrase."
    ].join(" ");

    const userPrompt = [
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
            vibe: typeof parsed.vibe === "string" ? parsed.vibe.trim() || null : null
        };
    } catch {
        return {
            summary: null,
            tags: FALLBACK_TAGS,
            vibe: null
        };
    }
}
