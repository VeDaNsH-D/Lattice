import axios from "axios";
import { mapToAllowedTags, normalizeTags } from "../utils/tagNormalizer.js";

const EMPTY_AI_DATA = {
    summary: null,
    tags: [],
    vibe: null
};

const MODEL_CANDIDATES = [
    process.env.GROQ_MODEL,
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile"
].filter(Boolean);

const extractJsonBlock = (value) => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return trimmed.slice(firstBrace, lastBrace + 1);
    }

    return null;
};

const normalizeAiData = (payload) => {
    const summary = typeof payload?.summary === "string" ? payload.summary.trim() : null;

    const rawTags = Array.isArray(payload?.tags) ? payload.tags : [];
    const normalizedTags = normalizeTags(rawTags);
    const finalTags = mapToAllowedTags(normalizedTags);

    const vibe = typeof payload?.vibe === "string" ? payload.vibe.trim() : null;

    return {
        summary: summary || null,
        tags: finalTags,
        vibe: vibe || null
    };
};

export const generateAIContent = async (title, description) => {
    if (!process.env.GROQ_API_KEY) {
        return EMPTY_AI_DATA;
    }

    const safeTitle = title || "Untitled";
    const safeDescription = description || "No description provided.";

    for (const model of MODEL_CANDIDATES) {
        try {
            const response = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model,
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are an intelligent content categorization system.\n\n" +
                                "Given a webpage title and description, generate:\n\n" +
                                "1. A concise 2-line summary\n" +
                                "2. EXACTLY 3 to 5 tags\n" +
                                "3. A single-word vibe\n\n" +
                                "IMPORTANT RULES FOR TAGS:\n" +
                                "- Tags must be lowercase\n" +
                                "- Tags must be 1 or 2 words only\n" +
                                "- Avoid generic words like 'news', 'article', 'latest'\n" +
                                "- Use meaningful categories (e.g., 'politics', 'finance', 'ai', 'sports', 'technology')\n" +
                                "- Tags must be reusable across different links"
                        },
                        {
                            role: "user",
                            content:
                                "Respond ONLY in JSON format:\n" +
                                "{\n" +
                                '  "summary": "...",\n' +
                                '  "tags": ["..."],\n' +
                                '  "vibe": "..."\n' +
                                "}\n\n" +
                                `Title: ${safeTitle}\n` +
                                `Description: ${safeDescription}`
                        }
                    ],
                    temperature: 0.4,
                    response_format: { type: "json_object" }
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 5000
                }
            );

            const rawContent = response.data?.choices?.[0]?.message?.content;
            const jsonBlock = extractJsonBlock(rawContent);

            if (!jsonBlock) {
                return EMPTY_AI_DATA;
            }

            const parsed = JSON.parse(jsonBlock);
            return normalizeAiData(parsed);
        } catch (error) {
            console.error(
                `Groq AI enrichment failed for model ${model}:`,
                error?.response?.status,
                error?.response?.data?.error?.message || error.message
            );
        }
    }

    return EMPTY_AI_DATA;
};
