import axios from "axios";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const MONTH_NAME_PATTERN = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";

const normalizeAiResponse = (content = "") => {
    const trimmed = content.trim();

    if (trimmed.startsWith("```")) {
        return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    return trimmed;
};

const parseDateString = (value) => {
    const text = (value || "").trim();

    if (!text) {
        return null;
    }

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }

    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }

    const dashMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashMatch) {
        const [, day, month, year] = dashMatch;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }

    const cleanedText = text.replace(/(\d{1,2})(st|nd|rd|th)/gi, "$1");
    const fallback = new Date(cleanedText);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const extractDateRegex = (text) => {
    if (typeof text !== "string" || !text.trim()) {
        return null;
    }

    const patterns = [
        /\d{4}-\d{2}-\d{2}/,
        /\d{1,2}-\d{1,2}-\d{4}/,
        /\d{1,2}\/\d{1,2}\/\d{4}/,
        new RegExp(`\\d{1,2}(?:st|nd|rd|th)?\\s${MONTH_NAME_PATTERN}\\s?\\d{4}`, "i"),
        new RegExp(`${MONTH_NAME_PATTERN}\\s\\d{1,2}(?:st|nd|rd|th)?,?\\s\\d{4}`, "i")
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[0];
        }
    }

    return null;
};

export const extractDateWithAI = async (title, description, extraText = "") => {
    try {
        const response = await axios.post(
            GROQ_API_URL,
            {
                model: GROQ_MODEL,
                messages: [
                    {
                        role: "user",
                        content: `You are a system that extracts deadline dates from content.\n\nGiven a title, description, and optional extra content, extract a deadline date.\n\nReturn ONLY JSON:\n{\n"deadline": "YYYY-MM-DD"\n}\n\nIf no date found, return:\n{\n"deadline": null\n}\n\nTitle: ${title || ""}\nDescription: ${description || ""}\nExtra: ${extraText || ""}`
                    }
                ],
                temperature: 0,
                max_tokens: 100
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const content = response?.data?.choices?.[0]?.message?.content;
        if (!content || typeof content !== "string") {
            return null;
        }

        const cleanedContent = normalizeAiResponse(content);
        const parsed = JSON.parse(cleanedContent);

        return typeof parsed?.deadline === "string" && parsed.deadline.trim()
            ? parsed.deadline.trim()
            : null;
    } catch (error) {
        return null;
    }
};

export const extractDeadlineFromText = async ({ title, description, extraText = "" }) => {
    try {
        const combinedText = `${title || ""} ${description || ""} ${extraText || ""}`.trim();
        const regexDate = extractDateRegex(combinedText);

        if (regexDate) {
            const parsedDate = parseDateString(regexDate);
            if (parsedDate) {
                return parsedDate;
            }
        }

        const aiDate = await extractDateWithAI(title, description, extraText);
        if (aiDate) {
            const parsedDate = parseDateString(aiDate);
            if (parsedDate) {
                return parsedDate;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
};

export const extractDeadline = async (title, description) => {
    return extractDeadlineFromText({ title, description, extraText: "" });
};
