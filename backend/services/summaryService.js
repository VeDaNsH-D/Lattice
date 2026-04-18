const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MAX_COMBINED_INPUT_CHARS = 1500;
const MAX_OUTPUT_CHARS = 1200;

function normalizeText(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}

function clipText(value, maxChars) {
    if (value.length <= maxChars) {
        return value;
    }

    return `${value.slice(0, maxChars - 3).trim()}...`;
}

function buildCombinedContent(pageContent, searchContext) {
    const page = normalizeText(pageContent);
    const context = normalizeText(searchContext);

    if (page && context) {
        return `Page Content:\n${page}\n\nWorld Context:\n${context}`;
    }

    if (page) {
        return `Page Content:\n${page}`;
    }

    if (context) {
        return `World Context:\n${context}`;
    }

    return "";
}

// Generates a concise summary using Groq with a safe fallback on failure.
export async function generateSummary(pageContent, searchContext = "") {
    const combinedContent = buildCombinedContent(pageContent, searchContext)
        .slice(0, MAX_COMBINED_INPUT_CHARS)
        .trim();

    if (!combinedContent) {
        return "No content available to summarize.";
    }

    try {
        const response = await fetch(GROQ_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    {
                        role: "system",
                        content: "You are a precise summarization engine.",
                    },
                    {
                        role: "user",
                        content:
                            "Summarize the following webpage content in exactly 3 concise sentences. Focus on key ideas and important developments.\n\n" +
                            combinedContent,
                    },
                ],
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            throw new Error(`Groq API failed with status ${response.status}`);
        }

        const payload = await response.json();
        const summaryText = normalizeText(payload?.choices?.[0]?.message?.content);

        if (!summaryText) {
            throw new Error("Groq API returned empty summary content");
        }

        return clipText(summaryText, MAX_OUTPUT_CHARS);
    } catch (error) {
        // Fallback keeps timeline pipeline functional even if the LLM call fails.
        const fallbackSource = normalizeText(pageContent) || normalizeText(searchContext) || combinedContent;
        return clipText(fallbackSource, MAX_OUTPUT_CHARS);
    }
}
