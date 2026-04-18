# Context-Aware AI Query Integration Guide

Quick steps to integrate the AI query system into your Lattice app.

## Backend Integration

### 1. Routes Already Registered ✓

The routes are already registered in `backend/index.js`:
```javascript
import aiRoutes from "./routes/ai.routes.js";
app.use("/api/ai", aiRoutes);
```

**Available endpoints:**
- `POST /api/ai/query` - Process query with contexts
- `POST /api/ai/validate-query` - Validate query
- `GET /api/ai/context-suggestions` - Get autocomplete suggestions

### 2. Environment Setup

Ensure your `.env` has these variables (should already be set):
```bash
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=your-groq-api-key
AI_CHAT_MODEL=llama-3.3-70b-versatile
```

### 3. Test Backend Endpoint

```bash
curl -X POST http://localhost:8000/api/ai/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d {
    "query": "@personal-notes summarise all links",
    "projectId": "optional-project-id"
  }
```

---

## Frontend Integration

### 1. Add Modal to App

In your main app layout (e.g., `LatticeFrame.jsx` or similar):

```jsx
import { useState } from 'react';
import { AskLatticeModal } from './components/AskLatticeModal';

export function MyApp() {
    const [isAskModalOpen, setIsAskModalOpen] = useState(false);

    return (
        <>
            {/* Your existing UI */}
            
            {/* Add Ask Lattice button */}
            <button 
                onClick={() => setIsAskModalOpen(true)}
                className="ask-lattice-btn"
            >
                Ask Lattice ✨
            </button>

            {/* Modal */}
            <AskLatticeModal 
                isOpen={isAskModalOpen}
                onClose={() => setIsAskModalOpen(false)}
                projectId={currentProjectId}
            />
        </>
    );
}
```

### 2. Wire into Spotlight

You can also wire this into your existing spotlight command palette:

```jsx
// In LatticeSpotlight.jsx

const actionCommands = useMemo(() => {
    const commands = [
        // ... existing commands
        {
            id: 'action:ask-ai',
            type: 'action',
            label: 'Ask Lattice AI',
            description: 'Query with @context mentions',
            actionKey: 'ask-ai'
        }
    ];
    return commands;
}, []);

// When executing:
if (command.actionKey === 'ask-ai') {
    window.dispatchEvent(new CustomEvent('lattice:open-ask-modal'));
}
```

Then listen for it:
```jsx
useEffect(() => {
    const handleOpenAsk = () => setIsAskModalOpen(true);
    window.addEventListener('lattice:open-ask-modal', handleOpenAsk);
    return () => window.removeEventListener('lattice:open-ask-modal', handleOpenAsk);
}, []);
```

### 3. Build Frontend

```bash
cd Frontend
npm run build
```

---

## Usage Examples for End Users

### Query a Lattice

```
@colab1 summarise all links
↓
System fetches all active links from "colab1" lattice
↓
LLM generates summary from your actual data
```

### Multi-Context Query

```
@auth-module @database explain their integration
↓
System fetches both contexts
↓
LLM explains how they work together
```

### Node Query

```
@api-docs what are the main endpoints
↓
System fetches the "api-docs" node details
↓
LLM answers based on that node
```

---

## Testing Checklist

### Backend

- [ ] Routes are registered in `index.js`
- [ ] Authentication middleware is applied
- [ ] Test with `@exists-lattice` (should find it)
- [ ] Test with `@nonexistent` (should return error)
- [ ] Test context resolution for lattices
- [ ] Test context resolution for nodes
- [ ] Verify LLM integration works

### Frontend

- [ ] Modal opens/closes correctly
- [ ] @mention dropdown shows suggestions
- [ ] Can select from suggestions
- [ ] Submit button enables when context + query present
- [ ] Loading state shows during request
- [ ] Response displays correctly
- [ ] Can edit and resubmit
- [ ] Error messages show properly

---

## Common Issues & Fixes

### "Context not found"
- Check if user has access to the lattice
- Verify exact lattice name (case-insensitive)
- Ensure lattice isn't archived

### Empty suggestions dropdown
- User needs at least one accessible lattice
- Try with different search prefix

### LLM returns generic response
- Check if context data is being fetched
- Verify lattice has active/decaying links
- Check system prompt is being transmitted

### CORS errors
- Make sure `FRONTEND_URL` env var is set
- Check origins in `backend/index.js`

---

## Optional: Keyboard Shortcut

Add keyboard shortcut to open the modal (similar to spotlight):

```jsx
useEffect(() => {
    const handleKeyDown = (e) => {
        // Cmd/Ctrl + Shift + A for Ask Lattice
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            setIsAskModalOpen(true);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

Then document it in your help/settings:
```
⌘ Shift A (Mac) or Ctrl Shift A (Windows) - Ask Lattice
```

---

## Performance Tuning

If you want to adjust performance:

```javascript
// In aiQuery.service.js, adjust these:
const DEFAULT_MAX_TOKENS = 800;      // Lower = faster response
const DEFAULT_TEMPERATURE = 0.7;      // Lower = more deterministic

// In contextResolver.js, adjust:
async function fetchLatticeLinks(projectId, limit = 50) {
    // Reduce limit (e.g., 30) for faster fetches
}
```

---

## Next: Suggested Enhancements

1. **Follow-up Questions**: Allow asking follow-ups within same context
2. **Export Response**: Add button to save response as document
3. **Pin Contexts**: Remember frequently used contexts
4. **Streaming**: Show LLM response character-by-character
5. **Analytics**: Track which contexts are used most
6. **Refinement UI**: Show "similar links" sidebar
7. **Voice Input**: Add voice-to-text for queries

---

## File Structure

```
backend/
  ├── services/
  │   ├── aiQuery.service.js (main orchestrator)
  │   ├── contextResolver.js (fetch context data)
  │   └── ai.client.js (LLM calls)
  ├── controllers/
  │   └── ai.controller.js (request handlers)
  ├── routes/
  │   └── ai.routes.js (endpoint definitions)
  └── utils/
      └── queryParser.js (parse @mentions)

Frontend/src/
  ├── services/
  │   └── aiQuery.js (API helpers)
  └── components/
      ├── AskLatticeModal.jsx (complete UI)
      └── AskLatticeModal.css (styles)
```

---

## Support

For issues or questions about the AI system:
1. Check [CONTEXT_AI_SYSTEM.md](./CONTEXT_AI_SYSTEM.md) for detailed documentation
2. Review component comments in source files
3. Test endpoints with curl commands provided above
