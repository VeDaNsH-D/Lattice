/**
 * AI Query Controller
 * Handles context-aware AI query requests
 */

import { processContextQuery, getContextSuggestions, validateContextQuery } from '../services/aiQuery.service.js';

/**
 * POST /ai/query
 * Process a context-aware query
 * 
 * Body:
 * - query: string (e.g., "@colab1 summarise all links")
 * - projectId: string (optional, for node context resolution)
 */
export async function askLattice(req, res, next) {
    try {
        const userId = req.user?.userId;
        const { query, projectId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'query is required and must be a string'
            });
        }

        const response = await processContextQuery({
            userInput: query,
            projectId: projectId || null,
            userId,
            temperature: 0.7,
            maxTokens: 1000
        });

        if (!response.success) {
            const message = response.error || 'AI query failed';
            const statusCode = message === 'No matching context found' || message === 'No data available in selected context'
                ? 404
                : 400;

            return res.status(statusCode).json({
                success: false,
                message,
                warnings: response.warnings || [],
            });
        }

        return res.status(200).json({
            success: true,
            answer: response.response,
            warnings: response.warnings || [],
            parsedQuery: response.parsedQuery,
            contextsResolved: response.resolvedContexts.length,
        });
    } catch (error) {
        return next(error);
    }
}

/**
 * POST /ai/validate-query
 * Validate a query without processing
 * 
 * Body:
 * - query: string
 */
export async function validateQuery(req, res, next) {
    try {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'query is required and must be a string'
            });
        }

        const validation = validateContextQuery(query);

        return res.status(200).json({
            success: true,
            data: validation
        });
    } catch (error) {
        return next(error);
    }
}

/**
 * GET /ai/context-suggestions
 * Get available contexts for autocomplete
 * 
 * Query params:
 * - search: string (prefix to search for)
 * - limit: number (max results)
 */
export async function getContexts(req, res, next) {
    try {
        const userId = req.user?.userId;
        const { search = '', limit = 10 } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const suggestions = await getContextSuggestions(
            userId,
            String(search).substring(0, 50),
            Math.min(Number(limit) || 10, 30)
        );

        return res.status(200).json({
            success: true,
            data: suggestions
        });
    } catch (error) {
        return next(error);
    }
}
