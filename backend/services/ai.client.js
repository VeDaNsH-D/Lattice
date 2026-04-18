import fs from "fs/promises";
import path from "path";

const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.groq.com/openai/v1";
const AI_API_KEY = process.env.AI_API_KEY || process.env.GROQ_API_KEY;

const CHAT_MODEL = process.env.AI_CHAT_MODEL || "llama-3.3-70b-versatile";
const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || "nomic-embed-text-v1.5";
const EMBEDDINGS_ENABLED = process.env.AI_EMBEDDINGS_ENABLED !== "false";
let embeddingDisabled = !EMBEDDINGS_ENABLED;

const TTS_BASE_URL = process.env.TTS_BASE_URL || AI_BASE_URL;
const TTS_API_KEY = process.env.TTS_API_KEY || AI_API_KEY;
const TTS_MODEL = process.env.TTS_MODEL || "playai-tts";
const TTS_VOICE = process.env.TTS_VOICE || "alloy";

function assertApiKey(keyName, value) {
    if (!value) {
        throw new Error(`${keyName} is missing in environment configuration.`);
    }
}

async function parseErrorResponse(response) {
    const body = await response.text();

    try {
        const parsed = JSON.parse(body);
        return parsed?.error?.message || body;
    } catch {
        return body;
    }
}

export async function createChatCompletion({
    systemPrompt,
    userPrompt,
    responseFormat,
    temperature = 0.2,
    maxTokens = 600
}) {
    assertApiKey("AI_API_KEY/GROQ_API_KEY", AI_API_KEY);

    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
            model: CHAT_MODEL,
            temperature,
            max_tokens: maxTokens,
            response_format: responseFormat,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        })
    });

    if (!response.ok) {
        const message = await parseErrorResponse(response);
        throw new Error(`AI chat completion failed: ${response.status} ${message}`);
    }

    const json = await response.json();
    return json?.choices?.[0]?.message?.content?.trim() || "";
}

export async function summarizeLinkToThreeSentences(link) {
    const content = [
        `URL: ${link.url || "unknown"}`,
        `Title: ${link.title || ""}`,
        `Description: ${link.description || ""}`,
        `Existing summary: ${link.summary || ""}`,
        `Tags: ${(link.tags || []).join(", ")}`
    ].join("\n");

    const systemPrompt = [
        "You summarize engineering links for a collaborative knowledge workspace.",
        "Return exactly 3 concise sentences in plain text.",
        "Do not use bullet points."
    ].join(" ");

    return createChatCompletion({
        systemPrompt,
        userPrompt: content,
        temperature: 0.3,
        maxTokens: 250
    });
}

function generateDeterministicEmbedding(text) {
    const dimensions = 64;
    const normalized = text ? text.trim().toLowerCase() : "";
    const vector = new Array(dimensions).fill(0);
    
    if (normalized) {
        for (let index = 0; index < normalized.length; index += 1) {
            const code = normalized.charCodeAt(index);
            const bucket = index % dimensions;
            vector[bucket] += Math.sin(code * (index + 1)) + Math.cos(code + index);
        }
    }
    
    const sumSquare = vector.reduce((sum, val) => sum + (val * val), 0);
    const norm = sumSquare > 0 ? Math.sqrt(sumSquare) : 1;
    return vector.map(val => val / norm);
}

export async function createEmbedding(text) {
    if (embeddingDisabled) {
        return generateDeterministicEmbedding(text);
    }

    assertApiKey("AI_API_KEY/GROQ_API_KEY", AI_API_KEY);

    const response = await fetch(`${AI_BASE_URL}/embeddings`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: text
        })
    });

    let generatedEmbedding = null;

    if (!response.ok) {
        const message = await parseErrorResponse(response);
        console.error(`Embedding generation failed: ${response.status} ${message}`);

        if (response.status === 404) {
            embeddingDisabled = true;
            console.warn(
                "Embeddings disabled for this runtime: model unavailable or no access. " +
                "Falling back to deterministic string hashing for graph structural connections."
            );
        }
    } else {
        const json = await response.json();
        generatedEmbedding = json?.data?.[0]?.embedding;
    }

    if (!Array.isArray(generatedEmbedding) || generatedEmbedding.length === 0) {
        const dimensions = 64;
        const normalized = text ? text.trim().toLowerCase() : "";
        const vector = new Array(dimensions).fill(0);
        
        if (normalized) {
            for (let index = 0; index < normalized.length; index += 1) {
                const code = normalized.charCodeAt(index);
                const bucket = index % dimensions;
                vector[bucket] += Math.sin(code * (index + 1)) + Math.cos(code + index);
            }
        }
        
        const sumSquare = vector.reduce((sum, val) => sum + (val * val), 0);
        const norm = sumSquare > 0 ? Math.sqrt(sumSquare) : 1;
        generatedEmbedding = vector.map(val => val / norm);
    }
    
    return generatedEmbedding;
}

export async function classifyCollision({ incomingText, candidateText }) {
    const systemPrompt = [
        "You compare two technical references.",
        "Classify relationship: overlap, conflict, mixed, or none.",
        "Return JSON only with keys collisionType, collisionScore, and reason.",
        "collisionScore must be a number from 0 to 1."
    ].join(" ");

    const userPrompt = [
        "Reference A:",
        incomingText,
        "",
        "Reference B:",
        candidateText
    ].join("\n");

    const content = await createChatCompletion({
        systemPrompt,
        userPrompt,
        responseFormat: { type: "json_object" },
        temperature: 0.1,
        maxTokens: 300
    });

    const parsed = JSON.parse(content);

    return {
        collisionType: ["overlap", "conflict", "mixed", "none"].includes(parsed.collisionType)
            ? parsed.collisionType
            : "none",
        collisionScore: Number.isFinite(parsed.collisionScore) ? parsed.collisionScore : 0,
        reason: typeof parsed.reason === "string" ? parsed.reason : ""
    };
}

export async function generateDailyPulseScript({ projectName, linkCount, summaries }) {
    const systemPrompt = [
        "You are a podcast script writer for a software team standup.",
        "Write a single short voice script that can be read in ~60 seconds.",
        "Use a confident newsroom tone and mention key themes.",
        "No markdown. No bullet points."
    ].join(" ");

    const userPrompt = [
        `Project: ${projectName || "Unknown project"}`,
        `Links added in last 24h: ${linkCount}`,
        "3-sentence summaries:",
        summaries.map((summary, index) => `${index + 1}. ${summary}`).join("\n")
    ].join("\n");

    return createChatCompletion({
        systemPrompt,
        userPrompt,
        temperature: 0.4,
        maxTokens: 320
    });
}

export async function synthesizeSpeechToFile({ text, outputFilePath }) {
    assertApiKey("TTS_API_KEY/AI_API_KEY/GROQ_API_KEY", TTS_API_KEY);

    const response = await fetch(`${TTS_BASE_URL}/audio/speech`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TTS_API_KEY}`
        },
        body: JSON.stringify({
            model: TTS_MODEL,
            voice: TTS_VOICE,
            input: text,
            format: "mp3"
        })
    });

    if (!response.ok) {
        const message = await parseErrorResponse(response);
        throw new Error(`TTS generation failed: ${response.status} ${message}`);
    }

    const audioBytes = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
    await fs.writeFile(outputFilePath, audioBytes);
}

export function getEmbeddingModelName() {
    return EMBEDDING_MODEL;
}
