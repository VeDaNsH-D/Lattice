const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MAX_SUMMARY_CHARS = 500;
const VALID_LEVELS = new Set(["none", "minor", "major"]);
const GROQ_MODELS = ["llama3-8b-8192", "llama-3.1-8b-instant"];

function normalizeText(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeLevel(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (VALID_LEVELS.has(normalized)) {
        return normalized;
    }

    // Accept common alternate labels returned by models.
    if (["no_change", "no change", "same", "unchanged"].includes(normalized)) {
        return "none";
    }

    if (["small", "low", "slight", "moderate", "medium"].includes(normalized)) {
        return "minor";
    }

    if (["high", "large", "significant", "substantial"].includes(normalized)) {
        return "major";
    }

    return "";
}

function sanitizeReason(value) {
    return normalizeText(value) || "Change classification generated.";
}

function tokenize(text) {
    return normalizeText(text)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

function jaccardSimilarity(aText, bText) {
    const aSet = new Set(tokenize(aText));
    const bSet = new Set(tokenize(bText));

    if (aSet.size === 0 && bSet.size === 0) {
        return 1;
    }

    let intersection = 0;

    for (const word of aSet) {
        if (bSet.has(word)) {
            intersection += 1;
        }
    }

    const union = new Set([...aSet, ...bSet]).size;
    return union === 0 ? 0 : intersection / union;
}

function fallbackRuleBased(oldSummary, newSummary, oldPageSummary = "", newPageSummary = "", oldContextSummary = "", newContextSummary = "") {
    const oldText = normalizeText(oldSummary).toLowerCase();
    const newText = normalizeText(newSummary).toLowerCase();
    const oldPage = normalizeText(oldPageSummary).toLowerCase();
    const newPage = normalizeText(newPageSummary).toLowerCase();
    const oldContext = normalizeText(oldContextSummary).toLowerCase();
    const newContext = normalizeText(newContextSummary).toLowerCase();

    if (oldText === newText && oldPage === newPage && oldContext === newContext) {
        return {
            level: "none",
            reason: "same summary content",
        };
    }

    const combinedSimilarity = jaccardSimilarity(oldText, newText);
    const pageSimilarity = oldPage || newPage ? jaccardSimilarity(oldPage, newPage) : 1;
    const contextSimilarity = oldContext || newContext ? jaccardSimilarity(oldContext, newContext) : 1;
    const similarity = (combinedSimilarity + pageSimilarity + contextSimilarity) / 3;

    if (similarity >= 0.65) {
        return {
            level: "minor",
            reason: "small textual difference detected",
        };
    }

    return {
        level: "major",
        reason: "significant textual difference detected",
    };
}

function parseResponseJson(text) {
    const raw = normalizeText(text);

    if (!raw) {
        return null;
    }

    // Support plain JSON as well as fenced JSON blocks from model responses.
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced ? fenced[1].trim() : raw;

    try {
        return JSON.parse(candidate);
    } catch (error) {
        const objectMatch = candidate.match(/\{[\s\S]*\}/);

        if (!objectMatch) {
            return null;
        }

        try {
            return JSON.parse(objectMatch[0]);
        } catch (nestedError) {
            return null;
        }
    }
}

function extractLevelAndReason(parsed) {
    if (!parsed || typeof parsed !== "object") {
        return {
            level: "",
            reason: "",
        };
    }

    return {
        level: normalizeLevel(parsed.level ?? parsed.change_level ?? parsed.classification),
        reason: sanitizeReason(parsed.reason ?? parsed.change_reason ?? parsed.explanation),
    };
}

async function requestGroqChangeDetection(apiKey, prompt) {
    let lastError = null;

    for (const model of GROQ_MODELS) {
        try {
            const response = await fetch(GROQ_ENDPOINT, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: "system",
                            content: "You are a precise change detection engine.",
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    temperature: 0.2,
                    response_format: { type: "json_object" },
                }),
            });

            const payload = await response.json();

            if (!response.ok) {
                const message = payload?.error?.message || `Groq API failed with status ${response.status}`;
                throw new Error(message);
            }

            return payload;
        } catch (error) {
            lastError = error;

            const message = String(error?.message || "").toLowerCase();
            const shouldTryNextModel =
                message.includes("decommissioned") ||
                message.includes("not supported") ||
                message.includes("model") ||
                message.includes("invalid_request_error");

            if (!shouldTryNextModel) {
                throw error;
            }
        }
    }

    throw lastError || new Error("All Groq model attempts failed");
}

function toCompatResult(result) {
    const safeResult = {
        level: normalizeLevel(result?.level) || "major",
        reason: sanitizeReason(result?.reason),
    };

    // Keep compatibility with existing synchronous-style callers while still
    // returning an awaitable result from an async function.
    const wrapped = Promise.resolve(safeResult);
    wrapped.level = safeResult.level;
    wrapped.reason = safeResult.reason;
    return wrapped;
}

export async function detectChange(oldSummary, newSummary) {
    const oldTrimmed = normalizeText(oldSummary).slice(0, MAX_SUMMARY_CHARS);
    const newTrimmed = normalizeText(newSummary).slice(0, MAX_SUMMARY_CHARS);

    const detailArg = arguments[2] || {};
    const oldPageTrimmed = normalizeText(detailArg.old_page_summary).slice(0, MAX_SUMMARY_CHARS);
    const newPageTrimmed = normalizeText(detailArg.new_page_summary).slice(0, MAX_SUMMARY_CHARS);
    const oldContextTrimmed = normalizeText(detailArg.old_context_summary).slice(0, MAX_SUMMARY_CHARS);
    const newContextTrimmed = normalizeText(detailArg.new_context_summary).slice(0, MAX_SUMMARY_CHARS);

    if (!oldTrimmed) {
        return toCompatResult({
            level: "major",
            reason: "initial snapshot",
        });
    }

    const prompt = `Compare the OLD and NEW summaries.

Classify the change:

* "none" → meaning is same
* "minor" → small updates or additions
* "major" → significant change, new ideas, or replacement of old concepts

Return ONLY JSON in this format:
{
"level": "none | minor | major",
"reason": "short explanation"
}

OLD:
${oldTrimmed}

NEW:
${newTrimmed}

OLD_PAGE_SUMMARY:
${oldPageTrimmed}

NEW_PAGE_SUMMARY:
${newPageTrimmed}

OLD_CONTEXT_SUMMARY:
${oldContextTrimmed}

NEW_CONTEXT_SUMMARY:
${newContextTrimmed}`;

    try {
        if (!process.env.GROQ_API_KEY) {
            throw new Error("Missing GROQ_API_KEY");
        }

        const payload = await requestGroqChangeDetection(process.env.GROQ_API_KEY, prompt);
        const llmContent = payload?.choices?.[0]?.message?.content;
        const parsed = parseResponseJson(llmContent);

        if (!parsed) {
            throw new Error("Failed to parse LLM JSON response");
        }

        const { level, reason } = extractLevelAndReason(parsed);

        if (!level) {
            throw new Error("LLM returned invalid change level");
        }

        return toCompatResult({ level, reason });
    } catch (error) {
        return toCompatResult(
            fallbackRuleBased(
                oldTrimmed,
                newTrimmed,
                oldPageTrimmed,
                newPageTrimmed,
                oldContextTrimmed,
                newContextTrimmed
            )
        );
    }
}
