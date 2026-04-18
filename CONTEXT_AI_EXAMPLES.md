/**
 * EXAMPLES: Context-Aware AI Query System
 * 
 * This file shows practical examples of how to use the system
 */

// ============================================================================
// BACKEND EXAMPLES
// ============================================================================

/**
 * Example 1: Direct Service Usage
 * 
 * Use the AI query service directly in your backend code
 */

import { processContextQuery } from './services/aiQuery.service.js';

// Example 1a: Single context query
async function example1a() {
    const result = await processContextQuery({
        userInput: '@database-notes summarise all links',
        userId: 'user-123',
        projectId: 'project-456'
    });

    if (result.success) {
        console.log('Response:', result.response);
        console.log('Contexts found:', result.parsedQuery.contexts);
    } else {
        console.error('Error:', result.error);
    }
}

// Example 1b: Multi-context query
async function example1b() {
    const result = await processContextQuery({
        userInput: '@auth-module @database combine them for scalable systems',
        userId: 'user-456',
        projectId: 'project-789'
    });

    if (result.success) {
        console.log('Response:', result.response);
        console.log('Resolved', result.resolvedContexts.length, 'contexts');
    }
}

/**
 * Example 2: API Endpoint Integration
 * 
 * Already implemented in ai.controller.js
 */

import express from 'express';
import { askLattice } from './controllers/ai.controller.js';

// Usage:
app.post('/api/ai/query', askLattice);

// Client would send:
// {
//   "query": "@colab1 explain OAuth2 implementation",
//   "projectId": "optional"
// }

/**
 * Example 3: Query Validation
 * 
 * Parse and validate queries without processing
 */

import { validateContextQuery } from './services/aiQuery.service.js';
import { parseContextQuery } from './utils/queryParser.js';

async function example3() {
    const validation = validateContextQuery('@project1 what are the main points');
    
    console.log('Validation result:', {
        isValid: validation.isValid,
        contexts: validation.contextsFound,        // ['project1']
        queryText: validation.queryText,           // 'what are the main points'
        contextCount: validation.contextCount       // 1
    });
}

/**
 * Example 4: Context Suggestions
 * 
 * Get available contexts for UI dropdown
 */

import { getContextSuggestions } from './services/aiQuery.service.js';

async function example4() {
    // Get all contexts user can access
    const allContexts = await getContextSuggestions('user-123');
    console.log('All available contexts:', allContexts);
    // Output:
    // [
    //   { name: 'project-docs', type: 'lattice', projectType: 'collaborative' },
    //   { name: 'personal-notes', type: 'lattice', projectType: 'personal' },
    //   ...
    // ]

    // Get filtered contexts
    const filtered = await getContextSuggestions('user-123', 'auth');
    console.log('Contexts matching "auth":', filtered);
}

/**
 * Example 5: Integration with Custom Logic
 * 
 * Use the system as part of larger workflows
 */

async function customLatticeAssistant(userId, query) {
    // Step 1: Parse query
    const parsed = parseContextQuery(query);
    
    if (!parsed.contexts.length) {
        return {
            error: 'Please mention a lattice with @lattice-name'
        };
    }

    // Step 2: Process through AI with current user
    const result = await processContextQuery({
        userInput: query,
        userId: userId,
        temperature: 0.8,  // More creative
        maxTokens: 1200
    });

    // Step 3: Post-process result
    if (result.success) {
        // Maybe save to database, send notification, etc.
        await saveQueryToHistory({
            userId,
            query: parsed.query,
            contexts: parsed.contexts,
            response: result.response,
            timestamp: new Date()
        });

        return {
            success: true,
            response: result.response,
            contextsUsed: result.resolvedContexts.length
        };
    }

    return {
        error: result.error,
        suggestions: 'Try checking if the lattice exists and you have access to it'
    };
}

// ============================================================================
// FRONTEND EXAMPLES
// ============================================================================

/**
 * Example 6: React Component Usage
 */

import React, { useState } from 'react';
import { AskLatticeModal } from './components/AskLatticeModal';

function MyPage() {
    const [isAskOpen, setIsAskOpen] = useState(false);
    const projectId = 'current-project'; // Your logic

    return (
        <div>
            <h1>My Lattice</h1>
            
            {/* Button to open AI modal */}
            <button onClick={() => setIsAskOpen(true)}>
                ✨ Ask AI
            </button>

            {/* Modal component */}
            <AskLatticeModal 
                isOpen={isAskOpen}
                onClose={() => setIsAskOpen(false)}
                projectId={projectId}
            />
        </div>
    );
}

/**
 * Example 7: Using AI Query Service in React
 */

import { 
    askLatticeAI, 
    validateAIQuery, 
    getAIContextSuggestions 
} from './services/aiQuery.js';

async function example7() {
    // Validate without sending
    const validation = await validateAIQuery('@colab1 summarise');
    
    if (!validation.isValid) {
        console.log('Invalid query. Need:', validation);
        return;
    }

    // Ask the AI
    const response = await askLatticeAI(
        '@colab1 summarise all links',
        'project-id'
    );

    if (response.success) {
        console.log('AI Response:', response.data.response);
    }
}

/**
 * Example 8: Autocomplete Suggestions
 */

async function example8() {
    const suggestions = await getAIContextSuggestions('auth', 10);
    
    console.log('Available contexts matching "auth":');
    suggestions.forEach(sug => {
        console.log(`  @${sug.name} (${sug.projectType})`);
    });
}

/**
 * Example 9: Integrating into Spotlight
 */

import { useNavigate } from 'react-router-dom';

function SpotlightWithAI() {
    const navigate = useNavigate();
    const [isAskModalOpen, setIsAskModalOpen] = useState(false);

    // When spotlight action is selected
    function handleSpotlightAction(command) {
        if (command.actionKey === 'ask-lattice') {
            // Open the ask modal
            setIsAskModalOpen(true);
        }
    }

    // Listen for spotlight events
    React.useEffect(() => {
        const handleAskModal = () => setIsAskModalOpen(true);
        window.addEventListener('lattice:open-ask-modal', handleAskModal);
        
        return () => {
            window.removeEventListener('lattice:open-ask-modal', handleAskModal);
        };
    }, []);

    return (
        <>
            {/* Your spotlight code */}
            <AskLatticeModal 
                isOpen={isAskModalOpen}
                onClose={() => setIsAskModalOpen(false)}
            />
        </>
    );
}

/**
 * Example 10: Custom UI Integration
 * 
 * If you want a different UI, use the service functions directly
 */

import { askLatticeAI, formatAIQuery, parseAIResponse } from './services/aiQuery.js';

function CustomAIUI() {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Format query for validation
        const formatted = formatAIQuery(query);
        
        if (!formatted.isValid) {
            alert('Please use @contextname syntax');
            return;
        }

        setLoading(true);
        try {
            // Call AI with formatted query
            const result = await askLatticeAI(query);
            
            // Parse response
            const parsed = parseAIResponse(result);
            setResponse(parsed);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input 
                    type="text"
                    placeholder="@lattice-name your question here"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Thinking...' : 'Ask'}
                </button>
            </form>

            {response && !response.success && (
                <div>Error: {response.response}</div>
            )}

            {response && response.success && (
                <div>
                    <div>AI: {response.response}</div>
                    <div>Contexts used: {response.contextsResolved}</div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// CURL EXAMPLES (Testing)
// ============================================================================

/*
# Test Ask Query

curl -X POST http://localhost:8000/api/ai/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "@personal-notes summarise all security-related links",
    "projectId": "optional-project-id"
  }'

Response:
{
    "success": true,
    "data": {
        "response": "Based on the personal-notes lattice, here are the key security topics...",
        "parsedQuery": {
            "contexts": ["personal-notes"],
            "query": "summarise all security-related links"
        },
        "contextsResolved": 1,
        "warnings": []
    }
}

---

# Test Validate Query

curl -X POST http://localhost:8000/api/ai/validate-query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "@auth-guide explain OAuth"
  }'

Response:
{
    "success": true,
    "data": {
        "isValid": true,
        "contextsFound": ["auth-guide"],
        "queryText": "explain OAuth",
        "contextCount": 1
    }
}

---

# Get Context Suggestions

curl -X GET 'http://localhost:8000/api/ai/context-suggestions?search=auth&limit=5' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

Response:
{
    "success": true,
    "data": [
        {
            "name": "auth-guide",
            "type": "lattice",
            "projectType": "collaborative"
        },
        {
            "name": "auth-notes",
            "type": "lattice", 
            "projectType": "personal"
        }
    ]
}
*/

// ============================================================================
// EXPORT
// ============================================================================

export {
    example1a,
    example1b,
    example3,
    example4,
    customLatticeAssistant,
    MyPage,
    example7,
    example8,
    SpotlightWithAI,
    CustomAIUI
};
