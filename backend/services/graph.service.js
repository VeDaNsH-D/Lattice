import LatticeNode from "../models/latticeNode.js";
import LatticeEdge from "../models/latticeEdge.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

const DEFAULT_EMBEDDING_DIMENSION = 64;
const SIMILARITY_THRESHOLD = 0.75;
const RELATED_NODE_LIMIT = 5;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeText = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().toLowerCase();
};

const normalizeTags = (tags = []) => {
    if (!Array.isArray(tags)) {
        return [];
    }

    return tags
        .map((tag) => normalizeText(tag))
        .filter(Boolean);
};

const vectorMagnitude = (vector) => {
    return Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
};

const normalizeVector = (vector = []) => {
    if (!Array.isArray(vector) || vector.length === 0) {
        return [];
    }

    const magnitude = vectorMagnitude(vector);

    if (!magnitude) {
        return vector.map(() => 0);
    }

    return vector.map((value) => value / magnitude);
};

const cosineSimilarity = (vectorA = [], vectorB = []) => {
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
        return 0;
    }

    const length = Math.min(vectorA.length, vectorB.length);

    if (!length) {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let index = 0; index < length; index += 1) {
        const a = Number(vectorA[index] || 0);
        const b = Number(vectorB[index] || 0);

        dotProduct += a * b;
        magnitudeA += a * a;
        magnitudeB += b * b;
    }

    if (!magnitudeA || !magnitudeB) {
        return 0;
    }

    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

const jaccardSimilarity = (tagsA = [], tagsB = []) => {
    const setA = new Set(normalizeTags(tagsA));
    const setB = new Set(normalizeTags(tagsB));

    if (!setA.size || !setB.size) {
        return 0;
    }

    let intersection = 0;

    for (const tag of setA) {
        if (setB.has(tag)) {
            intersection += 1;
        }
    }

    const union = new Set([...setA, ...setB]).size;

    return union ? intersection / union : 0;
};

const similarityToWeight = (cosineScore, tagScore) => {
    const semanticPortion = cosineScore * 0.8;
    const tagPortion = tagScore * 0.2;
    return clamp(semanticPortion + tagPortion, 0, 1);
};

const recencyFactor = (lastAccessed) => {
    if (!lastAccessed) {
        return 0.2;
    }

    const ageInDays = (Date.now() - new Date(lastAccessed).getTime()) / (1000 * 60 * 60 * 24);
    return clamp(1 - (ageInDays / 30), 0, 1);
};

const deterministicEmbedding = (text, dimensions = DEFAULT_EMBEDDING_DIMENSION) => {
    const source = normalizeText(text);
    const vector = new Array(dimensions).fill(0);

    if (!source) {
        return vector;
    }

    for (let index = 0; index < source.length; index += 1) {
        const code = source.charCodeAt(index);
        const bucket = index % dimensions;
        vector[bucket] += Math.sin(code * (index + 1)) + Math.cos(code + index);
    }

    return normalizeVector(vector);
};

const openAiHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
});

const fetchEmbedding = async (text) => {
    if (!OPENAI_API_KEY) {
        return deterministicEmbedding(text);
    }

    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
        method: "POST",
        headers: openAiHeaders(),
        body: JSON.stringify({
            model: OPENAI_EMBEDDING_MODEL,
            input: text,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI embeddings request failed with status ${response.status}`);
    }

    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;

    return Array.isArray(embedding) ? embedding : deterministicEmbedding(text);
};

const fetchChatCompletion = async ({ question, context }) => {
    if (!OPENAI_API_KEY) {
        return null;
    }

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: openAiHeaders(),
        body: JSON.stringify({
            model: OPENAI_CHAT_MODEL,
            temperature: 0.2,
            messages: [
                {
                    role: "system",
                    content: "You are a concise assistant for a living knowledge graph. Use the provided lattice context only and cite the strongest matching themes in a short, actionable answer.",
                },
                {
                    role: "user",
                    content: `Question: ${question}\n\nContext:\n${context}`,
                },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI chat request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
};

const buildFallbackAnswer = (question, matchedNodes = []) => {
    if (!matchedNodes.length) {
        return `I could not find enough lattice context to answer: ${question}`;
    }

    const highlights = matchedNodes.slice(0, 3).map((node) => {
        return `${node.title}: ${node.summary || "No summary available."}`;
    });

    return [
        `Based on the strongest matches for “${question}”:` ,
        ...highlights,
    ].join("\n\n");
};

const calculateImportanceScore = (node, connectionCount = 0) => {
    const recencyScore = recencyFactor(node.lastAccessed);
    const connectionScore = clamp(connectionCount / 10, 0, 1);
    const baseImportance = (recencyScore * 0.6) + (connectionScore * 0.4);

    return clamp(baseImportance || 0.1, 0, 1);
};

const updateNodeImportance = async (node) => {
    const connectionCount = await LatticeEdge.countDocuments({
        latticeId: node.latticeId,
        $or: [{ from: node._id }, { to: node._id }],
    });

    node.importanceScore = calculateImportanceScore(node, connectionCount);
    node.lastAccessed = new Date();

    return node.save();
};

const upsertDirectedEdge = async ({ from, to, latticeId, weight, type }) => {
    const existingEdge = await LatticeEdge.findOne({ from, to, latticeId, type });
    const nextWeight = existingEdge
        ? clamp((existingEdge.weight * 0.7) + (weight * 0.3), 0, 1)
        : clamp(weight, 0, 1);

    return LatticeEdge.findOneAndUpdate(
        { from, to, latticeId, type },
        { $set: { weight: nextWeight } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
};

const determineEdgeType = (nodeA, nodeB, tagScore, providedType = "semantic") => {
    if (providedType === "behavior") {
        return "behavior";
    }

    if (tagScore >= 0.4 || jaccardSimilarity(nodeA.tags, nodeB.tags) >= 0.4) {
        return "tag";
    }

    return "semantic";
};

export const findSimilarNodes = async (embedding, latticeId, options = {}) => {
    const { limit = RELATED_NODE_LIMIT, excludeNodeId = null } = options;

    const normalizedEmbedding = normalizeVector(embedding);

    const candidates = await LatticeNode.find(
        {
            latticeId,
            ...(excludeNodeId ? { _id: { $ne: excludeNodeId } } : {}),
        },
        {
            title: 1,
            summary: 1,
            embedding: 1,
            tags: 1,
            latticeId: 1,
            importanceScore: 1,
            lastAccessed: 1,
            createdAt: 1,
        }
    ).lean();

    return candidates
        .map((node) => {
            const cosineScore = cosineSimilarity(normalizedEmbedding, node.embedding || []);
            const tagScore = jaccardSimilarity(node.tags || [], []);

            return {
                ...node,
                similarity: cosineScore,
                tagSimilarity: tagScore,
            };
        })
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, limit);
};

export const createEdge = async (nodeA, nodeB, score, type = "semantic") => {
    const latticeId = nodeA.latticeId || nodeB.latticeId;
    const tagScore = jaccardSimilarity(nodeA.tags || [], nodeB.tags || []);
    const edgeType = determineEdgeType(nodeA, nodeB, tagScore, type);
    const weight = similarityToWeight(score, tagScore);

    const forwardEdge = await upsertDirectedEdge({
        from: nodeA._id,
        to: nodeB._id,
        latticeId,
        weight,
        type: edgeType,
    });

    const reverseEdge = await upsertDirectedEdge({
        from: nodeB._id,
        to: nodeA._id,
        latticeId,
        weight,
        type: edgeType,
    });

    return [forwardEdge, reverseEdge];
};

export const reinforceEdges = async (nodeA, nodeB, increment = 0.05, type = "behavior") => {
    const latticeId = nodeA.latticeId || nodeB.latticeId;

    const forwardEdge = await LatticeEdge.findOneAndUpdate(
        { from: nodeA._id, to: nodeB._id, latticeId, type },
        { $inc: { weight: increment } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const reverseEdge = await LatticeEdge.findOneAndUpdate(
        { from: nodeB._id, to: nodeA._id, latticeId, type },
        { $inc: { weight: increment } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    forwardEdge.weight = clamp(forwardEdge.weight, 0, 1);
    reverseEdge.weight = clamp(reverseEdge.weight, 0, 1);

    await forwardEdge.save();
    await reverseEdge.save();

    return [forwardEdge, reverseEdge];
};

export const buildGraphNode = async (newNode) => {
    const nodeToCreate = {
        ...newNode,
        tags: normalizeTags(newNode.tags),
        importanceScore: typeof newNode.importanceScore === "number" ? newNode.importanceScore : 1,
        lastAccessed: newNode.lastAccessed || new Date(),
    };

    const savedNode = await LatticeNode.create(nodeToCreate);
    const similarNodes = await findSimilarNodes(savedNode.embedding || [], savedNode.latticeId, {
        limit: RELATED_NODE_LIMIT,
        excludeNodeId: savedNode._id,
    });

    const createdEdges = [];

    for (const candidate of similarNodes) {
        const tagScore = jaccardSimilarity(savedNode.tags || [], candidate.tags || []);
        const combinedScore = similarityToWeight(candidate.similarity, tagScore);

        if (combinedScore >= SIMILARITY_THRESHOLD) {
            const edges = await createEdge(savedNode, candidate, combinedScore);
            createdEdges.push(...edges);
        }
    }

    await updateNodeImportance(savedNode);

    return {
        node: savedNode,
        relatedNodes: similarNodes,
        edges: createdEdges,
    };
};

export const getGraphSnapshot = async (latticeId) => {
    const [nodes, edges] = await Promise.all([
        LatticeNode.find({ latticeId }).sort({ createdAt: -1 }).lean(),
        LatticeEdge.find({ latticeId }).sort({ weight: -1 }).lean(),
    ]);

    return { nodes, edges };
};

export const getRelatedNodes = async (nodeId) => {
    const sourceNode = await LatticeNode.findById(nodeId);

    if (!sourceNode) {
        return null;
    }

    const edges = await LatticeEdge.find({
        latticeId: sourceNode.latticeId,
        $or: [{ from: sourceNode._id }, { to: sourceNode._id }],
    })
        .sort({ weight: -1 })
        .lean();

    const relatedIds = edges.map((edge) => String(edge.from) === String(sourceNode._id)
        ? edge.to
        : edge.from);

    const relatedNodes = await LatticeNode.find({
        _id: { $in: relatedIds },
        latticeId: sourceNode.latticeId,
    }).lean();

    const relatedById = new Map(relatedNodes.map((node) => [String(node._id), node]));

    return edges
        .map((edge) => {
            const relatedId = String(edge.from) === String(sourceNode._id) ? String(edge.to) : String(edge.from);
            return {
                edge,
                node: relatedById.get(relatedId) || null,
                weight: edge.weight,
            };
        })
        .filter((entry) => entry.node)
        .sort((left, right) => right.weight - left.weight);
};

export const queryLattice = async (question, latticeId) => {
    const questionEmbedding = await fetchEmbedding(question);
    const similarNodes = await findSimilarNodes(questionEmbedding, latticeId, { limit: 8 });

    const context = similarNodes
        .map((node, index) => {
            return [
                `Source ${index + 1}: ${node.title}`,
                `Summary: ${node.summary || "No summary available."}`,
                `Tags: ${(node.tags || []).join(", ") || "none"}`,
                `Similarity: ${node.similarity.toFixed(2)}`,
            ].join("\n");
        })
        .join("\n\n");

    const matchedNodes = await LatticeNode.find({
        _id: { $in: similarNodes.map((node) => node._id) },
    });

    await Promise.all(matchedNodes.map((node) => updateNodeImportance(node)));

    const answer = await fetchChatCompletion({ question, context }) || buildFallbackAnswer(question, similarNodes);

    if (matchedNodes.length > 1) {
        const [firstNode, ...otherNodes] = matchedNodes;
        await Promise.all(otherNodes.slice(0, 2).map((node) => reinforceEdges(firstNode, node, 0.03, "behavior")));
    }

    return {
        answer,
        matchedNodes: similarNodes,
        context,
    };
};

export const decayNodes = async ({ cutoffDays = 14, archiveDays = 30 } = {}) => {
    const now = Date.now();
    const nodes = await LatticeNode.find({}).lean();
    const updates = [];

    for (const node of nodes) {
        const ageInDays = (now - new Date(node.lastAccessed || node.createdAt || now).getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays >= archiveDays) {
            updates.push(LatticeNode.findByIdAndUpdate(node._id, { $set: { importanceScore: 0.05 } }));
        } else if (ageInDays >= cutoffDays) {
            const nextScore = clamp((node.importanceScore || 1) * 0.85, 0, 1);
            updates.push(LatticeNode.findByIdAndUpdate(node._id, { $set: { importanceScore: nextScore } }));
        }
    }

    await Promise.all(updates);

    return { updated: updates.length };
};

export const cleanupEdges = async ({ threshold = 0.25 } = {}) => {
    const result = await LatticeEdge.deleteMany({ weight: { $lt: threshold } });
    return { removed: result.deletedCount || 0 };
};
