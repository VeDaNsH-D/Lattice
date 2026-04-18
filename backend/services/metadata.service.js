import axios from "axios";
import * as cheerio from "cheerio";

const EMPTY_METADATA = {
    title: null,
    description: null,
    image: null
};

const isValidUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (error) {
        return false;
    }
};

const normalizeInputUrl = (value) => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    return isValidUrl(withProtocol) ? withProtocol : null;
};

const getMicrolinkMetadata = async (targetUrl) => {
    const response = await axios.get("https://api.microlink.io/", {
        params: {
            url: targetUrl,
            screenshot: true
        },
        timeout: 12000
    });

    const data = response.data?.data;
    const screenshot = data?.screenshot?.url ?? null;
    const fallbackImage = data?.image?.url ?? null;

    return {
        title: data?.title ?? null,
        description: data?.description ?? null,
        image: screenshot || fallbackImage || null
    };
};

const isWeakDescription = (value) => {
    if (!value || typeof value !== "string") {
        return true;
    }

    const normalized = value.toLowerCase().trim();
    if (normalized.length < 24) {
        return true;
    }

    return /(dashboard|home page|login|sign in|javascript disabled)/i.test(normalized);
};

const compact = (value) =>
    typeof value === "string"
        ? value.replace(/\s+/g, " ").trim()
        : null;

const isLikelyScriptNoise = (text) => {
    if (!text) {
        return true;
    }

    const normalized = text.toLowerCase();
    const signalMatches = [
        "function(",
        "function ",
        "var ",
        "let ",
        "const ",
        "window.",
        "document.",
        "add_event",
        "onclick",
        "gtag(",
        "dataLayer",
        "return false"
    ].reduce((count, signal) => count + (normalized.includes(signal) ? 1 : 0), 0);

    if (signalMatches >= 2) {
        return true;
    }

    const punctuationRatio = (text.match(/[{}();=<>]/g) || []).length / Math.max(text.length, 1);
    return punctuationRatio > 0.08;
};

const pickBestDescription = (candidates) => {
    for (const candidate of candidates) {
        const value = compact(candidate);
        if (!value) {
            continue;
        }

        if (value.length < 24) {
            continue;
        }

        if (isLikelyScriptNoise(value)) {
            continue;
        }

        return value;
    }

    return null;
};

const getScrapedMetadata = async (targetUrl) => {
    const response = await axios.get(targetUrl, {
        timeout: 12000,
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LatticeBot/1.0)",
            Accept: "text/html,application/xhtml+xml"
        }
    });

    const $ = cheerio.load(response.data);

    $("script, style, noscript, svg, iframe").remove();

    const title = compact($("title").first().text()) || compact($("h1").first().text()) || null;

    const paragraphCandidates = [];
    $("article p, main p, p").each((_, element) => {
        if (paragraphCandidates.length < 8) {
            paragraphCandidates.push($(element).text());
        }
    });

    const bodyText = compact($("body").text());
    const bodySnippet = bodyText ? bodyText.slice(0, 400) : null;

    const description = pickBestDescription([
        $("meta[name='description']").attr("content"),
        $("meta[property='og:description']").attr("content"),
        $("meta[name='twitter:description']").attr("content"),
        ...paragraphCandidates,
        bodySnippet
    ]);

    const image =
        compact($("meta[property='og:image']").attr("content")) ||
        compact($("meta[name='twitter:image']").attr("content")) ||
        null;

    return {
        title,
        description,
        image
    };
};

const getMinimalFallback = (targetUrl) => ({
    title: targetUrl,
    description: null,
    image: null
});

export const fetchMetadata = async (url) => {
    const normalizedUrl = normalizeInputUrl(url);

    if (!normalizedUrl) {
        return EMPTY_METADATA;
    }

    try {
        const microlinkMetadata = await getMicrolinkMetadata(normalizedUrl);

        if (isWeakDescription(microlinkMetadata.description)) {
            try {
                const scrapedMetadata = await getScrapedMetadata(normalizedUrl);
                return {
                    title: microlinkMetadata.title || scrapedMetadata.title,
                    description: isWeakDescription(microlinkMetadata.description)
                        ? scrapedMetadata.description || microlinkMetadata.description
                        : microlinkMetadata.description,
                    image: microlinkMetadata.image || scrapedMetadata.image
                };
            } catch (scrapeError) {
                return microlinkMetadata;
            }
        }

        return microlinkMetadata;
    } catch (microlinkError) {
        console.error(
            "Microlink metadata fetch failed:",
            microlinkError?.response?.status,
            microlinkError?.response?.data?.message || microlinkError.message
        );

        try {
            return await getScrapedMetadata(normalizedUrl);
        } catch (scrapeError) {
            console.error(
                "Fallback scraping failed:",
                scrapeError?.response?.status,
                scrapeError?.response?.data?.message || scrapeError.message
            );

            return getMinimalFallback(normalizedUrl);
        }
    }
};
