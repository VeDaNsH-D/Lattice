export const VIBE_TYPES = [
    "research",
    "tutorial",
    "news",
    "discussion",
    "tooling",
    "inspiration",
    "reference",
    "general"
];

const VIBE_KEYWORD_RULES = [
    { vibe: "research", keywords: ["paper", "study", "research", "analysis", "findings", "whitepaper"] },
    { vibe: "tutorial", keywords: ["guide", "tutorial", "how to", "walkthrough", "step by step", "course"] },
    { vibe: "news", keywords: ["news", "announcement", "launch", "update", "breaking", "release"] },
    { vibe: "discussion", keywords: ["thread", "discussion", "debate", "opinion", "forum", "reddit", "twitter"] },
    { vibe: "tooling", keywords: ["tool", "library", "framework", "api", "sdk", "plugin", "extension"] },
    { vibe: "inspiration", keywords: ["inspiration", "ideas", "showcase", "design", "creative", "portfolio"] },
    { vibe: "reference", keywords: ["reference", "docs", "documentation", "spec", "cheatsheet", "manual"] }
];

const URL_HINT_RULES = [
    { vibe: "reference", patterns: [/wikipedia\.org/i, /developer\.mozilla\.org/i, /docs\./i, /readthedocs\.io/i] },
    { vibe: "tutorial", patterns: [/youtube\.com/i, /coursera\.org/i, /udemy\.com/i, /freecodecamp\.org/i] },
    { vibe: "research", patterns: [/arxiv\.org/i, /scholar\.google\./i, /nature\.com/i, /research/i] },
    { vibe: "discussion", patterns: [/reddit\.com/i, /twitter\.com/i, /x\.com/i, /news\.ycombinator\.com/i, /medium\.com/i] },
    { vibe: "tooling", patterns: [/github\.com/i, /npmjs\.com/i, /pypi\.org/i, /producthunt\.com/i] }
];

export function normalizeVibe(rawValue, fallback = "general") {
    const normalizedFallback = VIBE_TYPES.includes(fallback) ? fallback : "general";
    const value = String(rawValue || "").trim().toLowerCase();

    if (!value) {
        return normalizedFallback;
    }

    if (VIBE_TYPES.includes(value)) {
        return value;
    }

    const sanitized = value.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    for (const rule of VIBE_KEYWORD_RULES) {
        if (rule.keywords.some((keyword) => sanitized.includes(keyword))) {
            return rule.vibe;
        }
    }

    return normalizedFallback;
}

export function classifyVibeFromContext(context = {}) {
    const {
        title = "",
        description = "",
        url = "",
        tags = [],
        parentHub = ""
    } = context;

    const text = [
        String(title || ""),
        String(description || ""),
        Array.isArray(tags) ? tags.join(" ") : "",
        String(parentHub || "")
    ]
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const scoreByVibe = new Map(VIBE_TYPES.map((vibe) => [vibe, 0]));

    for (const rule of VIBE_KEYWORD_RULES) {
        let score = 0;
        for (const keyword of rule.keywords) {
            if (text.includes(keyword)) {
                score += 1;
            }
        }

        if (score > 0) {
            scoreByVibe.set(rule.vibe, (scoreByVibe.get(rule.vibe) || 0) + score);
        }
    }

    const urlText = String(url || "").toLowerCase();
    for (const rule of URL_HINT_RULES) {
        if (rule.patterns.some((pattern) => pattern.test(urlText))) {
            scoreByVibe.set(rule.vibe, (scoreByVibe.get(rule.vibe) || 0) + 2);
        }
    }

    let bestVibe = "general";
    let bestScore = 0;

    for (const [vibe, score] of scoreByVibe.entries()) {
        if (vibe === "general") {
            continue;
        }

        if (score > bestScore) {
            bestScore = score;
            bestVibe = vibe;
        }
    }

    return bestScore > 0 ? bestVibe : "general";
}

export function resolveVibe(rawValue, context = {}) {
    const inferredVibe = classifyVibeFromContext(context);
    const normalizedVibe = normalizeVibe(rawValue, inferredVibe);

    if (normalizedVibe === "general" && inferredVibe !== "general") {
        return inferredVibe;
    }

    return normalizedVibe;
}
