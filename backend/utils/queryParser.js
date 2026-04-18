/**
 * Parse user query and extract @mentions as context references
 */

export function parseQuery(rawInput = '') {
    const input = String(rawInput).trim();
    
    if (!input) {
        return {
            contexts: [],
            query: ''
        };
    }

    // Extract all @mentions (words starting with @)
    const mentionPattern = /@([a-zA-Z0-9\-_]+)/g;
    const contexts = [];
    const seenContexts = new Set();

    let match;
    while ((match = mentionPattern.exec(input)) !== null) {
        const contextName = match[1].toLowerCase();
        
        // Avoid duplicates
        if (!seenContexts.has(contextName)) {
            contexts.push(contextName);
            seenContexts.add(contextName);
        }
    }

    // Remove @mentions from input to get the actual query
    const query = input
        .replace(mentionPattern, '')
        .trim()
        .replace(/\s+/g, ' '); // Normalize whitespace

    return {
        contexts,
        query
    };
}

// Backward-compatible alias used by existing code.
export const parseContextQuery = parseQuery;

/**
 * Validate that query has contexts and actual query text
 */
export function isValidContextQuery(parsedInput) {
    return Array.isArray(parsedInput.contexts) &&
        parsedInput.contexts.length > 0 &&
        typeof parsedInput.query === 'string' &&
        parsedInput.query.length > 3;
}

/**
 * Format contexts for display/logging
 */
export function formatContextsForDisplay(contexts = []) {
    if (!contexts.length) {
        return 'no contexts';
    }
    
    return contexts.map(ctx => `@${ctx}`).join(', ');
}
