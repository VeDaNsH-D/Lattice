# Context-Aware AI Query System

A modular system for processing user queries with @mention context references, resolving them to lattices/nodes, and sending structured data to an LLM for intelligent responses.

## Architecture Overview

```
User Input (@colab1 summarise links)
    ↓
[Query Parser] → Extract @mentions and query
    ↓
[Context Resolver] → Find lattices/nodes, fetch data
    ↓
[AI Service] → Build system prompt with context
    ↓
[LLM (Groq)] → Generate response
    ↓
Response to User
```

## Components

### 1. **Query Parser** (`backend/utils/queryParser.js`)

Extracts @mentions from user input and separates them from the query text.

```javascript
import { parseContextQuery } from 'path/to/queryParser.js';

const result = parseContextQuery("@colab1 @auth-notes explain authentication flow");
// Output: 
// {
//   contexts: ['colab1', 'auth-notes'],
//   query: 'explain authentication flow'
// }
```

**Functions:**
- `parseContextQuery(rawInput)` - Parse and extract contexts
- `isValidContextQuery(parsed)` - Validate parsed input
- `formatContextsForDisplay(contexts)` - Format for UI

---

### 2. **Context Resolver** (`backend/services/contextResolver.js`)

Resolves @mentions to actual lattices/nodes and fetches relevant data.

```javascript
import { resolveContexts } from 'path/to/contextResolver.js';

const resolution = await resolveContexts(
    ['colab1', 'auth-notes'],  // contexts
    projectId,
    userId
);

// Output:
// {
//   resolvedContexts: [
//     { type: 'lattice', id: '...', name: 'colab1' },
//     { type: 'node', id: '...', name: 'auth-notes' }
//   ],
//   contextData: "From lattice @colab1:\n1. Link 1 - summary...",
//   warnings: []
// }
```

**Fetches:**
- **Lattice context** → Fetches all active/decaying links with summaries
- **Node context** → Fetches specific node details and metadata
- **Warnings** → Reports if contexts not found or data is empty

---

### 3. **AI Query Service** (`backend/services/aiQuery.service.js`)

Orchestrates the full flow: parsing → resolution → LLM call → response.

```javascript
import { processContextQuery } from 'path/to/aiQuery.service.js';

const result = await processContextQuery({
    userInput: "@colab1 summarise all links",
    projectId: "optional-project-id",
    userId: "current-user-id",
    temperature: 0.7,
    maxTokens: 800
});

// Result:
// {
//   success: true,
//   response: "Based on the links in colab1, the main topics are...",
//   parsedQuery: { contexts: ['colab1'], query: '...' },
//   resolvedContexts: [...],
//   warnings: [],
//   reasoning: "..."
// }
```

---

### 4. **API Routes** (`backend/routes/ai.routes.js`)

Three endpoints for AI query operations:

#### `POST /api/ai/query`
Process a context-aware query.

**Request:**
```json
{
    "query": "@colab1 summarise all links",
    "projectId": "optional-id"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "response": "AI-generated answer...",
        "parsedQuery": {
            "contexts": ["colab1"],
            "query": "summarise all links"
        },
        "contextsResolved": 1,
        "warnings": []
    }
}
```

#### `POST /api/ai/validate-query`
Validate query syntax without processing.

**Request:**
```json
{
    "query": "@colab1 summarise links"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "isValid": true,
        "contextsFound": ["colab1"],
        "queryText": "summarise links",
        "contextCount": 1
    }
}
```

#### `GET /api/ai/context-suggestions?search=col&limit=10`
Get available contexts for @mention autocomplete.

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "name": "colab1",
            "type": "lattice",
            "projectType": "collaborative"
        },
        {
            "name": "personal-notes",
            "type": "lattice",
            "projectType": "personal"
        }
    ]
}
```

---

### 5. **Frontend Service** (`Frontend/src/services/aiQuery.js`)

Helper functions for the frontend to interact with the AI API.

```javascript
import {
    askLatticeAI,
    validateAIQuery,
    getAIContextSuggestions,
    formatAIQuery,
    parseAIResponse
} from 'path/to/services/aiQuery.js';

// Ask AI with context
const response = await askLatticeAI("@colab1 explain authentication");

// Validate without sending
const validation = await validateAIQuery("@colab1 some query");

// Get suggestions for UI
const suggestions = await getAIContextSuggestions("col", 10);

// Format for display
const formatted = formatAIQuery("@colab1 explain stuff");
// → { contexts: ['colab1'], query: '...', isValid: true }

// Parse response
const parsed = parseAIResponse(response);
```

---

### 6. **React Component** (`Frontend/src/components/AskLatticeModal.jsx`)

Complete UI component with @mention suggestions and response display.

**Features:**
- Input field with @mention support
- Real-time suggestions dropdown
- Query validation feedback
- Response display with edit capability
- Error handling and warnings
- Loading state with animation

**Usage:**
```jsx
import { AskLatticeModal } from 'path/to/AskLatticeModal.jsx';

export function MyPage() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button onClick={() => setIsOpen(true)}>Ask Lattice</button>
            <AskLatticeModal 
                isOpen={isOpen} 
                onClose={() => setIsOpen(false)}
                projectId="current-project-id"
            />
        </>
    );
}
```

---

## System Prompt Design

The system constructs a context-aware prompt:

```
You are a helpful AI assistant for a knowledge management workspace called Lattice.
Answer questions based ONLY on the provided context below.
If the context does not contain the information needed to answer, say so honestly.
Keep responses concise and focused.

--- PROVIDED CONTEXT ---
From lattice @colab1:
1. "Authentication Guide" - Overview of OAuth2 flow and JWT implementation
2. "Database Security" - Best practices for credential storage
...
--- END CONTEXT ---

If the context is incomplete or empty, mention that when answering.
```

---

## Error Handling

The system handles several error cases gracefully:

| Case | Behavior |
|------|----------|
| No contexts found | Returns error: "No contexts found" |
| Context not found | Warns in response but continues if other contexts valid |
| Empty lattice | Includes warning but still generates response |
| LLM error | Returns API error with detailed message |
| Invalid input | Returns validation error |

---

## Usage Examples

### Example 1: Summarize a Lattice

```
User Input: "@project-docs summarise all links"

→ Parser extracts:
  - Context: "project-docs"
  - Query: "summarise all links"

→ Resolver finds:
  - Lattice named "project-docs"
  - Fetches 15 active links with summaries

→ LLM receives:
  - System: "Answer based only on provided context"
  - Context: [15 link summaries]
  - Query: "summarise all links"

→ Response: "Based on the project-docs lattice, here are the main topics covered:
   1. Architecture overview...
   2. API documentation...
   ..."
```

### Example 2: Cross-Context Query

```
User Input: "@auth-module @database-config explain their integration"

→ Resolves TWO contexts:
  - Node "auth-module" in current lattice
  - Lattice "database-config"

→ Combines data from both sources

→ LLM generates integrated explanation
```

### Example 3: Node Query Within Lattice

```
User Input: "@oauth2-guide explain this"

→ Searches for node named "oauth2-guide" in current project

→ Returns detailed explanation based on node summary and tags
```

---

## Data Flow

### 1. Link Data Structure (for lattice context)

```javascript
{
    title: "Understanding OAuth2",
    url: "https://...",
    summary: "Comprehensive guide covering tokens, scopes, and flows",
    tags: ["authentication", "security", "oauth"],
    description: "..."
}
```

### 2. Node Data Structure (for node context)

```javascript
{
    title: "JWT Implementation",
    summary: "Best practices for JWT issuance and validation",
    tags: ["tokens", "security"],
    importance: 1
}
```

### 3. Formatted Context for LLM

```
From lattice @colab1:
1. "Link 1 Title" - Link 1 summary
2. "Link 2 Title" - Link 2 summary
3. "Link 3 Title" - Link 3 summary

From node @specific-node:
Title: Specific Node Title
Summary: Node summary text
```

---

## Performance Considerations

**Optimizations:**
- Links query limited to 50 per lattice
- Suggestions query limited to 30 results
- Debounced autocomplete (300ms)
- Efficiency: ~2-3 DB queries per request

**Limits:**
- Max 5 context mentions per query
- Max tokens: 1000 (can be configured)
- Max suggestion results: 30

---

## Next Steps (Optional Enhancements)

1. **Semantic Search**: Use embeddings to find most relevant links
2. **Multi-turn Conversations**: Remember context across multiple queries
3. **Caching**: Cache resolutions for frequently used contexts
4. **Streaming**: Stream LLM responses for faster UX
5. **Analytics**: Track which contexts are queried most
6. **Refinement**: Allow follow-up questions within same context
7. **Export**: Export Q&A to document format

---

## Troubleshooting

**Context not found:**
- Ensure lattice name matches exactly (except case-insensitive)
- Check user has access to the lattice

**Empty response:**
- Lattice may be empty (has no links)
- Try another context or re-check lattice contents

**LLM timeout:**
- API may be slow, try with fewer contexts
- Check Groq API status

**No suggestions:**
- Check user is authenticated
- Verify user has at least one accessible lattice
