/**
 * Context-aware AI query service
 * Orchestrates parsing, context resolution, and LLM calls
 */

import { parseQuery as parseQueryInput, isValidContextQuery, formatContextsForDisplay } from "../utils/queryParser.js";
import { 
    resolveContexts as resolveContextData,
    hasValidContextData 
} from "./contextResolver.js";
import Project from "../models/project.js";

const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MODEL = process.env.GROQ_MODEL || process.env.AI_CHAT_MODEL || "llama-3.1-8b-instant";
const GROQ_BASE_URL = process.env.AI_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_API_KEY = process.env.AI_API_KEY || process.env.GROQ_API_KEY;

export function parseQuery(userInput = "") {
    return parseQueryInput(userInput);
}

export async function resolveContexts(contexts = [], projectId = null, userId = null) {
    return resolveContextData(contexts, projectId, userId);
}

export function buildPrompt({ summaries = [], query = "" } = {}) {
    const formattedSummaries = summaries.length
        ? summaries
            .map((entry, idx) => `${idx + 1}. [@${entry.context}] ${entry.title} - ${entry.summary}`)
            .join("\n")
        : "(No summaries available)";

    return [
        "You are an assistant for Lattice.",
        "",
        "Answer ONLY using the provided context.",
        "Write a clean, professional response.",
        "Use short, readable paragraphs.",
        "Do not use markdown symbols like ** or backticks.",
        "",
        "Context:",
        formattedSummaries,
        "",
        "User Query:",
        query,
    ].join("\n");
}

export async function callGroq(prompt, { temperature = DEFAULT_TEMPERATURE, maxTokens = DEFAULT_MAX_TOKENS } = {}) {
    if (!GROQ_API_KEY) {
        throw new Error("GROQ API key is not configured");
    }

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [
                { role: "user", content: prompt },
            ],
            temperature,
            max_tokens: maxTokens,
        }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const apiErrorMessage = payload?.error?.message || payload?.message || "Groq request failed";
        throw new Error(apiErrorMessage);
    }

    return String(payload?.choices?.[0]?.message?.content || "").trim();
}

/**
 * Process a context-aware query end-to-end
 * 
 * Returns structured response with reasoning
 */
export async function processContextQuery({
    userInput = '',
    projectId = null,
    userId = null,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS
} = {}) {
    try {
        // Validate required inputs
        if (!userId) {
            throw new Error('userId is required');
        }

        if (!userInput || String(userInput).trim().length === 0) {
            return {
                success: false,
                error: 'Query cannot be empty',
                response: null,
                reasoning: 'No input provided'
            };
        }

        // Step 1: Parse input to extract contexts and query
        const parsed = parseQuery(userInput);

        // If the user asks from inside a project without @mentions, treat the
        // current project as the implicit context so Ask AI still works.
        if (!parsed.contexts.length && projectId) {
            const project = await Project.findOne({
                _id: projectId,
                isActive: true,
                $or: [
                    { createdBy: userId },
                    { members: userId },
                    { isPublic: true }
                ]
            })
                .select('name projectType')
                .lean();

            if (project) {
                parsed.contexts = [project.name.toLowerCase()];
            }
        }

        // Step 2: Validate contexts and normalize query text.
        if (!parsed.contexts.length) {
            return {
                success: false,
                error: 'No matching context found',
                response: null,
                reasoning: `No @contexts in query: "${parsed.query}"`
            };
        }

        // If user only types @context, default to a summary ask.
        if (!parsed.query) {
            parsed.query = 'summarise all links';
        } else if (!isValidContextQuery(parsed)) {
            return {
                success: false,
                error: 'Query too short',
                response: null,
                reasoning: `Found ${parsed.contexts.length} contexts, query: "${parsed.query}"`
            };
        }

        // Step 3: Resolve contexts to actual data
        const resolution = await resolveContexts(
            parsed.contexts,
            projectId,
            userId
        );

        // Step 4: Check if any contexts were resolved
        if (!hasValidContextData(resolution.resolvedContexts)) {
            return {
                success: false,
                error: 'No matching context found',
                response: null,
                reasoning: `Contexts: ${formatContextsForDisplay(parsed.contexts)}. Warnings: ${resolution.warnings.join('; ')}`,
                warnings: resolution.warnings
            };
        }

        // Step 5: Check summary availability
        if (!Array.isArray(resolution.summaries) || resolution.summaries.length === 0) {
            return {
                success: false,
                error: 'No data available in selected context',
                response: null,
                warnings: resolution.warnings,
                reasoning: `Resolved contexts but no summaries found for: ${formatContextsForDisplay(parsed.contexts)}`
            };
        }

        // Step 6: Build prompt + call Groq
        const prompt = buildPrompt({
            summaries: resolution.summaries,
            query: parsed.query,
        });

        const aiResponse = await callGroq(prompt, { temperature, maxTokens });

        // Step 7: Structure and return response
        return {
            success: true,
            response: aiResponse,
            parsedQuery: {
                contexts: parsed.contexts,
                query: parsed.query
            },
            resolvedContexts: resolution.resolvedContexts,
            warnings: resolution.warnings,
            contextDataUsed: resolution.contextData.length,
            reasoning: `Resolved ${resolution.resolvedContexts.length} contexts with ${resolution.summaries.length} summaries`
        };
    } catch (error) {
        console.error('Error processing context query:', error);

        return {
            success: false,
            error: error.message || 'Failed to process query',
            response: null,
            reasoning: error.stack
        };
    }
}

/**
 * Quick validation - check if a query can be processed
 */
export function validateContextQuery(userInput = '') {
    const parsed = parseQuery(userInput);
    return {
        isValid: isValidContextQuery(parsed),
        contextsFound: parsed.contexts,
        queryText: parsed.query,
        contextCount: parsed.contexts.length
    };
}

/**
 * Get suggestions for available contexts (lattices user has access to)
 * Can be used for frontend autocomplete when user types "@"
 */
export async function getContextSuggestions(userId, searchPrefix = '', limit = 10) {
    if (!userId) {
        return [];
    }

    try {
        const Project = (await import('../models/project.js')).default;

        // Find projects (lattices) the user has access to
        const projects = await Project.find({
            $or: [
                { createdBy: userId },
                { members: userId },
                { isPublic: true }
            ],
            isActive: true,
            ...(searchPrefix ? { name: { $regex: searchPrefix, $options: 'i' } } : {})
        })
            .select('name projectType')
            .limit(limit)
            .lean();

        return projects.map(p => ({
            name: p.name,
            type: 'lattice',
            projectType: p.projectType
        }));
    } catch (error) {
        console.error('Error getting context suggestions:', error);
        return [];
    }
}

/**
 * Format error response consistently
 */
export function formatErrorResponse(error) {
    return {
        success: false,
        error: error.message || 'Unknown error',
        response: null,
        reasoning: error.message
    };
}

/**
 * Format success response consistently
 */
export function formatSuccessResponse(response, reasoning = '') {
    return {
        success: true,
        response,
        reasoning: reasoning || 'Query processed successfully'
    };
}
