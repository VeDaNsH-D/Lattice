/**
 * Frontend service for context-aware AI queries
 */

import { apiRequest } from '../utils/api';

/**
 * Ask Lattice a context-aware query
 * @param {string} query - Query with @mentions (e.g., "@lattice1 explain this")
 * @param {string} projectId - Optional project ID for node context
 * @returns {Promise} AI response with parsed contexts and reasoning
 */
export async function askLatticeAI(query, projectId = null) {
    const body = {
        query: String(query).trim()
    };

    if (projectId) {
        body.projectId = projectId;
    }

    const response = await apiRequest('/ai/query', {
        method: 'POST',
        body: JSON.stringify(body)
    });

    return response;
}

/**
 * Validate a query without processing it
 * Checks if it has valid @mentions and query text
 * @param {string} query - Query to validate
 * @returns {Promise} Validation result with contexts found and query text
 */
export async function validateAIQuery(query) {
    const response = await apiRequest('/ai/validate-query', {
        method: 'POST',
        body: JSON.stringify({ query: String(query).trim() })
    });

    return response;
}

/**
 * Get context suggestions for autocomplete
 * Returns available lattices/nodes the user can reference
 * @param {string} searchPrefix - Prefix to search for (e.g., "col" to find "colab1")
 * @param {number} limit - Max number of suggestions
 * @returns {Promise} Array of available contexts
 */
export async function getAIContextSuggestions(searchPrefix = '', limit = 10) {
    const params = new URLSearchParams();

    if (searchPrefix) {
        params.set('search', String(searchPrefix).substring(0, 50));
    }

    if (limit && limit > 0) {
        params.set('limit', Math.min(limit, 30).toString());
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await apiRequest(`/ai/context-suggestions${query}`, {
        method: 'GET'
    });

    return response.data || [];
}

/**
 * Format an AI query for display
 * Shows @mentions and query text clearly
 * @param {string} query - Raw query string
 * @returns {Object} Formatted query info
 */
export function formatAIQuery(query) {
    const mentionPattern = /@([a-zA-Z0-9\-_]+)/g;
    const contexts = [];

    let match;
    while ((match = mentionPattern.exec(query)) !== null) {
        contexts.push(match[1]);
    }

    const queryText = query
        .replace(/@([a-zA-Z0-9\-_]+)/g, '')
        .trim()
        .replace(/\s+/g, ' ');

    return {
        contexts,
        query: queryText,
        displayContexts: contexts.length > 0 ? contexts.map(c => `@${c}`).join(', ') : 'no contexts',
        isValid: contexts.length > 0 && queryText.length > 3
    };
}

/**
 * Parse AI response for display
 * Extracts relevant info for UI rendering
 * @param {Object} aiResponse - Response from askLatticeAI
 * @returns {Object} Parsed response info
 */
export function parseAIResponse(aiResponse) {
    if (!aiResponse) {
        return {
            success: false,
            response: 'No response',
            contexts: [],
            warnings: []
        };
    }

    const { success, data, error, message, answer, warnings, parsedQuery, contextsResolved } = aiResponse;

    if (!success) {
        return {
            success: false,
            response: message || error || 'Query failed',
            contexts: [],
            warnings: []
        };
    }

    return {
        success: true,
        response: answer || data?.response || 'No response generated',
        contexts: parsedQuery?.contexts || data?.parsedQuery?.contexts || [],
        contextsResolved: contextsResolved || data?.contextsResolved || 0,
        warnings: warnings || data?.warnings || []
    };
}
