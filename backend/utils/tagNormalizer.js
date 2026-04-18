const BLOCKED_WORDS = new Set(["news", "latest", "update"]);

export const allowedTags = [
    "ai",
    "technology",
    "startup",
    "finance",
    "business",
    "sports",
    "politics",
    "health",
    "education",
    "design"
];

const normalizeSingleTag = (tag) => {
    if (typeof tag !== "string") {
        return null;
    }

    const cleaned = tag
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!cleaned) {
        return null;
    }

    if (BLOCKED_WORDS.has(cleaned)) {
        return null;
    }

    const words = cleaned
        .split(" ")
        .filter(Boolean)
        .filter((word) => !BLOCKED_WORDS.has(word));

    if (words.length === 0 || words.length > 2) {
        return null;
    }

    return words.join(" ");
};

export const normalizeTags = (tags) => {
    if (!Array.isArray(tags)) {
        return [];
    }

    const normalized = tags
        .map(normalizeSingleTag)
        .filter(Boolean);

    return [...new Set(normalized)].slice(0, 5);
};

const tagAliases = {
    political: "politics",
    politics: "politics",
    govt: "politics",
    government: "politics",
    tech: "technology",
    technological: "technology",
    fintech: "finance",
    finance: "finance",
    "business news": "business",
    commerce: "business",
    entrepreneurship: "startup",
    "sports news": "sports",
    wellness: "health",
    medtech: "health",
    edtech: "education",
    learning: "education",
    uiux: "design",
    ux: "design"
};

export const mapToAllowedTags = (tags) => {
    if (!Array.isArray(tags)) {
        return [];
    }

    const mapped = tags.map((tag) => {
        const canonical = tagAliases[tag] || tag;

        if (allowedTags.includes(canonical)) {
            return canonical;
        }

        if (canonical.includes("tech")) {
            return "technology";
        }

        if (canonical.includes("sport")) {
            return "sports";
        }

        if (canonical.includes("polit")) {
            return "politics";
        }

        return canonical;
    });

    return [...new Set(mapped)].slice(0, 5);
};
