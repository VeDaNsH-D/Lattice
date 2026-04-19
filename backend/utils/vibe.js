export const VIBE_TYPES = [
    "high-signal",
    "educational",
    "motivational",
    "chaotic",
    "cursed",
    "general"
];

const VIBE_ALIASES = {
    research: "high-signal",
    reference: "high-signal",
    tooling: "high-signal",
    tutorial: "educational",
    inspiration: "motivational",
    news: "chaotic",
    discussion: "chaotic",
    cursed: "cursed",
    general: "general",
    neutral: "general",
    "high-signal": "high-signal",
    "high_signal": "high-signal",
    educational: "educational",
    motivational: "motivational",
    chaotic: "chaotic"
};

const VIBE_KEYWORD_RULES = [
    { vibe: "cursed", keywords: ["broken", "dead", "redirect", "redirects", "404", "expired", "obsolete", "stale", "cursed", "archive", "archived", "error"] },
    { vibe: "educational", keywords: ["guide", "tutorial", "how to", "walkthrough", "step by step", "course", "learn", "lesson", "docs", "documentation", "reference"] },
    { vibe: "high-signal", keywords: ["paper", "study", "research", "analysis", "findings", "whitepaper", "spec", "cheatsheet", "manual", "tool", "library", "framework", "api", "sdk", "plugin", "extension"] },
    { vibe: "chaotic", keywords: ["news", "announcement", "launch", "update", "breaking", "release", "thread", "discussion", "debate", "opinion", "forum", "reddit", "twitter", "x", "medium"] },
    { vibe: "motivational", keywords: ["inspiration", "ideas", "showcase", "design", "creative", "portfolio", "motivation", "aspire", "aspirational", "bold", "vision"] }
];

const URL_HINT_RULES = [
    { vibe: "cursed", patterns: [/404/i, /broken/i, /redirect/i, /expired/i, /dead/i, /obsolete/i] },
    { vibe: "educational", patterns: [/youtube\.com/i, /coursera\.org/i, /udemy\.com/i, /freecodecamp\.org/i, /wikipedia\.org/i, /developer\.mozilla\.org/i, /readthedocs\.io/i] },
    { vibe: "high-signal", patterns: [/arxiv\.org/i, /scholar\.google\./i, /nature\.com/i, /github\.com/i, /npmjs\.com/i, /pypi\.org/i, /docs\./i, /research/i] },
    { vibe: "chaotic", patterns: [/reddit\.com/i, /twitter\.com/i, /x\.com/i, /news\.ycombinator\.com/i, /medium\.com/i] },
    { vibe: "motivational", patterns: [/dribbble\.com/i, /behance\.net/i, /producthunt\.com/i, /portfolio/i, /showcase/i] }
];

const TITLE_HINT_RULES = [
    { vibe: "educational", patterns: [/(how to|tutorial|guide|walkthrough|course|lesson|documentation|docs|explained|explain|reference)/i] },
    { vibe: "high-signal", patterns: [/(breaking|analysis|report|research|study|benchmark|release|launch|official|announcement|postmortem|changelog)/i] },
    { vibe: "chaotic", patterns: [/(thread|debate|drama|controversy|hot take|opinion|rant|vs\.|why is|wtf|what the)/i] },
    { vibe: "cursed", patterns: [/(cursed|meme|shitpost|unhinged|bizarre|weird|wtf|absurd|nightmare|uncanny)/i] },
    { vibe: "motivational", patterns: [/(inspiration|showcase|portfolio|design|creative|vision|aspire|bold)/i] }
];

function normalizeComparableText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeVibeToken(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
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

export function normalizeVibe(rawValue, fallback = "general") {
    const normalizedFallback = VIBE_TYPES.includes(fallback) ? fallback : "general";
    const value = normalizeVibeToken(rawValue);

    if (!value) {
        return normalizedFallback;
    }

    if (VIBE_TYPES.includes(value)) {
        return value;
    }

    if (VIBE_ALIASES[value]) {
        return VIBE_ALIASES[value];
    }

    const sanitized = String(rawValue || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();

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
    ].join(" ");

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
            scoreByVibe.set("high-signal", (scoreByVibe.get("high-signal") || 0) + 2);
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
            scoreByVibe.set("high-signal", (scoreByVibe.get("high-signal") || 0) + 2);
        }

        if (/\b(reddit|x com|twitter|news ycombinator|threads net|medium)\b/.test(domainText)) {
            scoreByVibe.set("chaotic", (scoreByVibe.get("chaotic") || 0) + 2);
        }

        if (/\b(imgur|9gag|knowyourmeme|tiktok|cringe)\b/.test(domainText)) {
            scoreByVibe.set("cursed", (scoreByVibe.get("cursed") || 0) + 2);
        }
    }

    if (/\b(news|breaking|live|update|latest|article)\b/.test(normalizedTitle) && !/\b(how to|guide|tutorial|docs|course)\b/.test(normalizedTitle)) {
        scoreByVibe.set("high-signal", (scoreByVibe.get("high-signal") || 0) + 1);
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
