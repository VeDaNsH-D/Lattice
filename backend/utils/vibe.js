export const VIBE_TYPES = [
    "chaotic",
    "educational",
    "cursed",
    "high_signal",
    "neutral"
];

const LEGACY_VIBE_ALIASES = {
    research: "high_signal",
    tutorial: "educational",
    news: "high_signal",
    discussion: "chaotic",
    tooling: "high_signal",
    inspiration: "cursed",
    reference: "educational",
    general: "neutral",
    "high-signal": "high_signal",
    "high signal": "high_signal",
    educational: "educational",
    chaotic: "chaotic",
    cursed: "cursed",
    neutral: "neutral"
};

const VIBE_KEYWORD_RULES = [
    {
        vibe: "high_signal",
        keywords: [
            "breaking", "analysis", "benchmark", "report", "paper", "research", "release", "official",
            "security advisory", "postmortem", "changelog", "announcement"
        ]
    },
    {
        vibe: "educational",
        keywords: [
            "guide", "tutorial", "how to", "walkthrough", "course", "documentation", "docs", "explainer",
            "reference", "cheatsheet", "lesson"
        ]
    },
    {
        vibe: "chaotic",
        keywords: [
            "thread", "debate", "drama", "hot take", "controversy", "opinion", "rant", "war", "discourse",
            "fight", "meltdown"
        ]
    },
    {
        vibe: "cursed",
        keywords: [
            "cursed", "meme", "shitpost", "absurd", "unhinged", "bizarre", "weird", "wtf", "nightmare",
            "uncanny", "chaos"
        ]
    }
];

const URL_HINT_RULES = [
    { vibe: "educational", patterns: [/wikipedia\.org/i, /developer\.mozilla\.org/i, /docs\./i, /readthedocs\.io/i, /coursera\.org/i, /udemy\.com/i, /freecodecamp\.org/i, /khanacademy\.org/i, /learn\.microsoft\.com/i, /stack\soverflow\.com/i] },
    { vibe: "high_signal", patterns: [/arxiv\.org/i, /scholar\.google\./i, /nature\.com/i, /reuters\.com/i, /bloomberg\.com/i, /ft\.com/i, /github\.com/i, /docs\.google\.com/i, /substack\.com/i, /medium\.com/i] },
    { vibe: "chaotic", patterns: [/reddit\.com/i, /twitter\.com/i, /x\.com/i, /news\.ycombinator\.com/i, /threads\.net/i] },
    { vibe: "cursed", patterns: [/knowyourmeme\.com/i, /9gag\.com/i, /imgur\.com/i, /tiktok\.com/i, /cringe\.com/i] }
];

const TITLE_HINT_RULES = [
    { vibe: "educational", patterns: [/(how to|tutorial|guide|walkthrough|course|lesson|documentation|docs|explained|explain|reference)/i] },
    { vibe: "high_signal", patterns: [/(breaking|analysis|report|research|study|benchmark|release|launch|official|announcement|postmortem|changelog)/i] },
    { vibe: "chaotic", patterns: [/(thread|debate|drama|controversy|hot take|opinion|rant|vs\.|why is|wtf|what the)/i] },
    { vibe: "cursed", patterns: [/(cursed|meme|shitpost|unhinged|bizarre|weird|wtf|absurd|nightmare|uncanny)/i] }
];

function normalizeComparableText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function scoreRules(text, rules) {
    const scores = new Map(VIBE_TYPES.map((vibe) => [vibe, 0]));

    for (const rule of rules) {
        let total = 0;
        const patterns = Array.isArray(rule.patterns) ? rule.patterns : [];
        const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];

        for (const pattern of patterns) {
            if (pattern.test(text)) {
                total += 1;
            }
        }

        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                total += 1;
            }
        }

        if (total > 0) {
            scores.set(rule.vibe, (scores.get(rule.vibe) || 0) + total);
        }
    }

    return scores;
}

export function normalizeVibe(rawValue, fallback = "neutral") {
    const normalizedFallback = VIBE_TYPES.includes(fallback) ? fallback : "neutral";
    const value = String(rawValue || "").trim().toLowerCase();

    if (!value) {
        return normalizedFallback;
    }

    const normalizedValue = value.replace(/[-\s]+/g, "_");

    if (VIBE_TYPES.includes(normalizedValue)) {
        return normalizedValue;
    }

    if (LEGACY_VIBE_ALIASES[value]) {
        return LEGACY_VIBE_ALIASES[value];
    }

    if (LEGACY_VIBE_ALIASES[normalizedValue]) {
        return LEGACY_VIBE_ALIASES[normalizedValue];
    }

    const sanitized = normalizeComparableText(value);

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
        .join(" ");

    const normalizedText = normalizeComparableText(text);
    const normalizedTitle = normalizeComparableText(title);
    const normalizedDescription = normalizeComparableText(description);
    const domainText = normalizeComparableText(url);

    const scoreByVibe = new Map(VIBE_TYPES.map((vibe) => [vibe, 0]));

    for (const [vibe, score] of scoreRules(normalizedText, VIBE_KEYWORD_RULES)) {
        scoreByVibe.set(vibe, (scoreByVibe.get(vibe) || 0) + score);
    }

    for (const [vibe, score] of scoreRules(normalizedTitle, TITLE_HINT_RULES)) {
        scoreByVibe.set(vibe, (scoreByVibe.get(vibe) || 0) + score * 2);
    }

    for (const rule of URL_HINT_RULES) {
        if (rule.patterns.some((pattern) => pattern.test(String(url || "")))) {
            scoreByVibe.set(rule.vibe, (scoreByVibe.get(rule.vibe) || 0) + 3);
        }
    }

    if (normalizedDescription) {
        if (/\b(learn|lesson|course|tutorial|how to|guide|documentation|docs|explained)\b/.test(normalizedDescription)) {
            scoreByVibe.set("educational", (scoreByVibe.get("educational") || 0) + 2);
        }

        if (/\b(breaking|analysis|report|research|benchmark|official|announcement|release|postmortem|changelog)\b/.test(normalizedDescription)) {
            scoreByVibe.set("high_signal", (scoreByVibe.get("high_signal") || 0) + 2);
        }

        if (/\b(thread|debate|drama|opinion|rant|controversy|wtf|hot take|vs\.)\b/.test(normalizedDescription)) {
            scoreByVibe.set("chaotic", (scoreByVibe.get("chaotic") || 0) + 2);
        }

        if (/\b(cursed|meme|shitpost|unhinged|weird|bizarre|absurd|uncanny)\b/.test(normalizedDescription)) {
            scoreByVibe.set("cursed", (scoreByVibe.get("cursed") || 0) + 2);
        }
    }

    if (domainText) {
        if (/\b(youtube|vimeo|udemy|coursera|freecodecamp|khanacademy)\b/.test(domainText)) {
            scoreByVibe.set("educational", (scoreByVibe.get("educational") || 0) + 2);
        }

        if (/\b(github|gitlab|npmjs|pypi|docs|readthedocs|developer|stack overflow|stackoverflow)\b/.test(domainText)) {
            scoreByVibe.set("high_signal", (scoreByVibe.get("high_signal") || 0) + 2);
        }

        if (/\b(reddit|x com|twitter|news ycombinator|threads net|medium)\b/.test(domainText)) {
            scoreByVibe.set("chaotic", (scoreByVibe.get("chaotic") || 0) + 2);
        }

        if (/\b(imgur|9gag|knowyourmeme|tiktok|cringe)\b/.test(domainText)) {
            scoreByVibe.set("cursed", (scoreByVibe.get("cursed") || 0) + 2);
        }
    }

    if (/\b(news|breaking|live|update|latest|article)\b/.test(normalizedTitle) && !/\b(how to|guide|tutorial|docs|course)\b/.test(normalizedTitle)) {
        scoreByVibe.set("high_signal", (scoreByVibe.get("high_signal") || 0) + 1);
    }

    let bestVibe = "neutral";
    let bestScore = 0;

    for (const [vibe, score] of scoreByVibe.entries()) {
        if (vibe === "neutral") {
            continue;
        }

        if (score > bestScore) {
            bestScore = score;
            bestVibe = vibe;
        }
    }

    return bestScore > 0 ? bestVibe : "neutral";
}

export function resolveVibe(rawValue, context = {}) {
    const inferredVibe = classifyVibeFromContext(context);
    const normalizedVibe = normalizeVibe(rawValue, inferredVibe);

    if (normalizedVibe === "neutral" && inferredVibe !== "neutral") {
        return inferredVibe;
    }

    return normalizedVibe;
}
