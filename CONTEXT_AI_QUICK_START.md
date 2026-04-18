# Context-Aware AI System - Quick Start Guide

> **Status:** ✅ All code implemented, tested, and ready to use

## What You've Built

A system that lets users ask questions about their lattices using natural language:

```
User types: "@project-notes summarise all links"
         ↓ (@mention parsing → Context lookup → Link fetching)
        ↓ (Sends to LLM with context data)
         ↓ (Returns AI-generated summary)
Result: "Based on project-notes, here are the key topics..."
```

## Prerequisites

Make sure these are already running in your project:
- ✅ Express backend server (localhost:8000)
- ✅ MongoDB database with your data
- ✅ React frontend (with Vite)
- ✅ JWT authentication middleware
- ✅ Groq AI client (already in your codebase)

## 5-Minute Setup

### Step 1: Ensure Backend Routes Loaded
Check `/backend/index.js` line ~40:
```javascript
import aiRoutes from "./routes/ai.routes.js";
app.use("/api/ai", aiRoutes);
```
✅ Already done in this session.

### Step 2: Import Modal in Your Main App
Open `Frontend/src/App.jsx` or your main layout component:

```jsx
import { AskLatticeModal } from './components/AskLatticeModal';

export default function App() {
  const [isAskOpen, setIsAskOpen] = useState(false);

  return (
    <div>
      {/* Your existing layout */}
      
      {/* Add Ask button */}
      <button onClick={() => setIsAskOpen(true)}>✨ Ask AI</button>
      
      {/* Add modal */}
      <AskLatticeModal 
        isOpen={isAskOpen}
        onClose={() => setIsAskOpen(false)}
        projectId={currentProjectId}
      />
    </div>
  );
}
```

### Step 3: Test It

1. **Start backend** (if not running):
   ```bash
   cd backend
   npm start
   ```

2. **Start frontend** (if not running):
   ```bash
   cd Frontend
   npm run dev
   ```

3. **Open app** and click "Ask AI" button

4. **Type a query**:
   ```
   @personal-notes list all authentication-related links
   ```

5. **Watch it work!** ✨

## Quick Test Commands

### Backend Only (No Frontend)

```bash
# Test validation
curl -X POST http://localhost:8000/api/ai/validate-query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "@my-lattice what are the main topics"}'

# Test full query
curl -X POST http://localhost:8000/api/ai/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "@my-lattice summarise all links"}'

# Get available contexts
curl -X GET "http://localhost:8000/api/ai/context-suggestions?search=my&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Architecture Overview

```
Frontend                          Backend                    LLM
┌──────────────────┐            ┌──────────────────┐
│ AskLatticeModal  │──POST───→  │ /api/ai/query    │
│ (React)          │            │ (ai.controller)  │
└──────────────────┘            └─────────┬────────┘
                                          │
                                          ↓
                             ┌─────────────────────┐
                             │ Query Parser Utils  │
                             │ (queryParser.js)    │
                             └──────────┬──────────┘
                                        │
                                        ↓
                             ┌─────────────────────┐
                             │ Context Resolver    │
                             │ (contextResolver.js)│
                             └──────────┬──────────┘
                                        │
                                 ┌──────┴──────┐
                                 ↓             ↓
                            MongoDB      AI Service
                         (Project, Link) (Groq LLM)
                                 │             │
                                 └──────┬──────┘
                                        ↓
                             ┌─────────────────────┐
                             │ AI Response         │
                             │ (aiQuery.service.js)│
                             └──────────┬──────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ↓                                       ↓
        ┌──────────────────────┐              ┌──────────────────────┐
        │ Parse Response       │              │ Display in Modal    │
        │ (aiQuery.js)         │              │ (AskLatticeModal)   │
        └──────────────────────┘              └──────────────────────┘
```

## File Locations Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| Query Parser | `/backend/utils/queryParser.js` | Extract @mentions |
| Context Resolver | `/backend/services/contextResolver.js` | Fetch lattice data |
| AI Orchestrator | `/backend/services/aiQuery.service.js` | Main logic |
| API Controller | `/backend/controllers/ai.controller.js` | HTTP handlers |
| API Routes | `/backend/routes/ai.routes.js` | Endpoint setup |
| Frontend Service | `/Frontend/src/services/aiQuery.js` | API calls |
| React Component | `/Frontend/src/components/AskLatticeModal.jsx` | UI |
| Component Styles | `/Frontend/src/components/AskLatticeModal.css` | Styling |

## Features Included

### ✨ User Features
- 🔤 Type queries with @mention syntax
- 📊 See suggestions as you type
- ⚡ Real-time validation feedback
- 💬 AI responses in a clean modal
- ⚠️ Error messages if context not found

### 🛠️ Technical Features
- 🔐 JWT authentication required
- 🎯 Multi-context support (query 5 lattices at once)
- 📦 Modular architecture
- 🧪 Linting verified (no errors)
- 🏗️ Production build verified
- 📚 Comprehensive documentation

## Keyboard Shortcuts (Built-in)

- **Tab** to select from suggestions dropdown
- **Escape** to close modal
- **Enter** to submit query

## Common Issues & Solutions

### "Context not found"
- Make sure you spelled the lattice name correctly
- Use @partial-name to get suggestions
- Check you have access to that lattice

### "No response from AI"
- Check backend is running on port 8000
- Check your JWT token is valid
- Check Groq API key is set in backend

### "@mention suggestions not showing"
- Make sure you've typed @
- Wait a second for dropdown to appear
- Check browser console for errors

### Modal doesn't open
- Check `isOpen` prop is passing `true`
- Check `onClose` handler is set
- Verify projectId is provided

## Next Steps

### After First Test
1. ✅ Verify suggestions appear as you type
2. ✅ Test a simple query like "@your-lattice what are the main topics"
3. ✅ Try multi-context queries like "@context1 @context2 combine these"

### Optional Enhancements
- Add keyboard shortcut (Ctrl+Shift+A) to open modal
- Add export/copy button for responses
- Add follow-up questions
- Add streaming responses (real-time text)
- Track usage analytics

See `CONTEXT_AI_INTEGRATION.md` section "Optional Enhancements" for details.

## Documentation Files

| File | Purpose |
|------|---------|
| `CONTEXT_AI_SYSTEM.md` | Complete system architecture & data flow |
| `CONTEXT_AI_INTEGRATION.md` | Step-by-step integration guide |
| `CONTEXT_AI_EXAMPLES.md` | Code examples for backend & frontend |
| `CONTEXT_AI_QUICK_START.md` | This file - quick reference |

## Support

If something doesn't work:
1. Check the error message in browser console
2. Read the relevant section in `CONTEXT_AI_INTEGRATION.md`
3. Look for similar patterns in `CONTEXT_AI_EXAMPLES.md`
4. Verify all prerequisites are running

---

**You're all set!** 🚀 Your AI system is ready to use.

Start with: `Click "Ask AI" → Type "@your-lattice name your query" → Hit Enter`
