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
        timeout: 5000
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

const getScrapedMetadata = async (targetUrl) => {
    const response = await axios.get(targetUrl, {
        timeout: 5000,
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ShelfLifeBot/1.0)",
            Accept: "text/html,application/xhtml+xml"
        }
    });

    const $ = cheerio.load(response.data);

    const title = $("title").first().text()?.trim() || null;
    const description =
        $("meta[name='description']").attr("content")?.trim() || null;
    const image =
        $("meta[property='og:image']").attr("content")?.trim() || null;

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
        return await getMicrolinkMetadata(normalizedUrl);
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
