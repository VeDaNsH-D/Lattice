import { chromium } from "playwright";

const MAX_TEXT_CHARS = 3000;

function normalizeText(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}

export async function fetchPageContent(url) {
    const browser = await chromium.launch({ headless: true });

    try {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(url, {
            waitUntil: "networkidle",
            timeout: 30000,
        });

        const rawContent = await page.evaluate(() => {
            const title = document.title || "";

            const paragraphs = Array.from(document.querySelectorAll("p"))
                .map(p => p.innerText)
                .join(" ");

            return `${title} ${paragraphs}`;
        });

        const cleaned = normalizeText(rawContent);

        return cleaned.length > 50
            ? cleaned.slice(0, MAX_TEXT_CHARS)
            : "No meaningful content extracted";
    } finally {
        await browser.close();
    }
}