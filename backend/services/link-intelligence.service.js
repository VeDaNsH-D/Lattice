import Link from "../models/link.js";
import Message from "../models/message.js";
import ProjectMember from "../models/projectMember.js";
import Room from "../models/room.js";
import { generateAIContent } from "./ai.service.js";
import {
    classifyCollision,
    createEmbedding,
    getEmbeddingModelName,
    summarizeLinkToThreeSentences
} from "./ai.client.js";

const SEMANTIC_MATCH_THRESHOLD = Number(process.env.COLLISION_SIMILARITY_THRESHOLD || 0.84);
const AI_COLLISION_THRESHOLD = Number(process.env.COLLISION_AI_SCORE_THRESHOLD || 0.55);

function buildLinkText(link) {
    return [
        `URL: ${link.url || ""}`,
        `Title: ${link.title || ""}`,
        `Description: ${link.description || ""}`,
        `Summary: ${link.summary || ""}`,
        `Tags: ${(link.tags || []).join(", ")}`
    ].join("\n");
}

function cosineSimilarity(vectorA, vectorB) {
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
        return 0;
    }

    if (!vectorA.length || vectorA.length !== vectorB.length) {
        return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let index = 0; index < vectorA.length; index += 1) {
        const a = Number(vectorA[index]) || 0;
        const b = Number(vectorB[index]) || 0;

        dot += a * b;
        normA += a * a;
        normB += b * b;
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function ensureSummaryAndEmbedding(link) {
    const updates = {};
    const linkData = typeof link.toObject === "function" ? link.toObject() : link;

    if (!link.summary) {
        updates.summary = await summarizeLinkToThreeSentences(link);
    }

    if (!Array.isArray(link.embedding) || link.embedding.length === 0) {
        const embedding = await createEmbedding(buildLinkText({ ...linkData, ...updates }));

        if (Array.isArray(embedding) && embedding.length > 0) {
            updates.embedding = embedding;
            updates.embeddingModel = getEmbeddingModelName();
        }
    }

    // Generate AI tags if they're missing
    if (!link.tags || link.tags.length === 0) {
        const aiContent = await generateAIContent(link.title, link.description);
        if (aiContent.tags && aiContent.tags.length > 0) {
            updates.tags = aiContent.tags;
        }
        if (!link.vibe && aiContent.vibe) {
            updates.vibe = aiContent.vibe;
        }
    }

    if (Object.keys(updates).length > 0) {
        await Link.updateOne({ _id: link._id }, { $set: updates });
        Object.assign(link, updates);
    }

    return link;
}

async function ensureCandidatesEmbeddings(candidates) {
    for (const candidate of candidates) {
        if (!Array.isArray(candidate.embedding) || candidate.embedding.length === 0) {
            const embedding = await createEmbedding(buildLinkText(candidate));

            if (!Array.isArray(embedding) || embedding.length === 0) {
                continue;
            }

            candidate.embedding = embedding;
            candidate.embeddingModel = getEmbeddingModelName();

            await Link.updateOne(
                { _id: candidate._id },
                {
                    $set: {
                        embedding,
                        embeddingModel: candidate.embeddingModel
                    }
                }
            );
        }
    }
}

function buildDebateStarterMessage({ incomingLink, candidateLink, collisionType, reason }) {
    const relationLabel = collisionType === "conflict" ? "conflicts with" : "overlaps with";

    return [
        `Warning: This new article \"${incomingLink.title || incomingLink.url}\" ${relationLabel} \"${candidateLink.title || candidateLink.url}\" saved earlier.`,
        "Which direction are we leaning?",
        reason ? `AI note: ${reason}` : ""
    ]
        .filter(Boolean)
        .join(" ");
}

async function openDebateThread({ projectId, incomingLink, candidateLink, collisionType, collisionScore, reason }) {
    const orderedIds = [String(incomingLink._id), String(candidateLink._id)].sort();

    const existingThread = await Room.findOne({
        projectId,
        kind: "debate",
        "meta.linkIds": { $all: orderedIds, $size: 2 },
        isActive: true
    });

    if (existingThread) {
        return existingThread;
    }

    const members = await ProjectMember.find({ projectId }).select("userId");
    const participants = members.map((member) => member.userId);

    const room = await Room.create({
        projectId,
        name: `Debate: ${(incomingLink.title || "new link").slice(0, 40)} vs ${(candidateLink.title || "existing link").slice(0, 40)}`,
        kind: "debate",
        participants,
        meta: {
            linkIds: orderedIds,
            collisionType,
            collisionScore,
            openedBy: "ai"
        }
    });

    await Message.create({
        roomId: room._id,
        type: "ai",
        text: buildDebateStarterMessage({
            incomingLink,
            candidateLink,
            collisionType,
            reason
        }),
        linkIds: [incomingLink._id, candidateLink._id],
        meta: {
            collisionType,
            collisionScore
        }
    });

    return room;
}

export async function processNewLinkForCollision(link) {
    await ensureSummaryAndEmbedding(link);

    const candidates = await Link.find({
        projectId: link.projectId,
        _id: { $ne: link._id }
    })
        .sort({ createdAt: -1 })
        .limit(40);

    if (!candidates.length) {
        await Link.updateOne({ _id: link._id }, { $set: { collisionCheckedAt: new Date() } });
        return { collisionDetected: false };
    }

    await ensureCandidatesEmbeddings(candidates);

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const candidate of candidates) {
        const similarity = cosineSimilarity(link.embedding, candidate.embedding);

        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = candidate;
        }
    }

    await Link.updateOne({ _id: link._id }, { $set: { collisionCheckedAt: new Date() } });

    if (!bestMatch || bestSimilarity < SEMANTIC_MATCH_THRESHOLD) {
        return { collisionDetected: false, similarity: bestSimilarity };
    }

    const incomingText = buildLinkText(link);
    const candidateText = buildLinkText(bestMatch);
    const analysis = await classifyCollision({ incomingText, candidateText });

    const isCollision =
        ["overlap", "conflict", "mixed"].includes(analysis.collisionType) &&
        (analysis.collisionScore >= AI_COLLISION_THRESHOLD || bestSimilarity >= 0.9);

    if (!isCollision) {
        return {
            collisionDetected: false,
            similarity: bestSimilarity,
            analysis
        };
    }

    const debateRoom = await openDebateThread({
        projectId: link.projectId,
        incomingLink: link,
        candidateLink: bestMatch,
        collisionType: analysis.collisionType,
        collisionScore: Number(((analysis.collisionScore + bestSimilarity) / 2).toFixed(3)),
        reason: analysis.reason
    });

    return {
        collisionDetected: true,
        similarity: bestSimilarity,
        analysis,
        matchedLinkId: bestMatch._id,
        debateRoomId: debateRoom._id
    };
}

export async function ensureLinkEnrichment(link) {
    await ensureSummaryAndEmbedding(link);
    return link;
}
