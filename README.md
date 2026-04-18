# Lattice

Lattice is a full-stack collaboration app for building, sharing, and remixing project spaces. The current repo includes a Node/Express/MongoDB backend, a React/Vite frontend, realtime Socket.IO collaboration, shared bookmark comments, and public project discovery with fork/remix support.

## What’s in the repo now

### Backend

- Express API with MongoDB/Mongoose models for users, projects, links, roles, members, invites, rooms, messages, comments, graph data, and timeline/pulse features.
- Authentication endpoints for register, login, current-user lookup, and Google OAuth flow.
- Project APIs for create/list plus membership lookup used by the realtime workspace.
- Search APIs for spotlight and home-page discovery of users and public projects.
- Remix APIs for listing public projects, forking a public project, toggling visibility, and reading project lineage.
- Comment APIs for link bookmark threads with resolve/unresolve support.
- Socket.IO realtime collaboration for room presence, chat, reactions, cursor updates, screen share state, and WebRTC signaling.

### Frontend

- React + Vite application with protected and public routes.
- Landing page, auth pages, and the Lattice workspace shell.
- Home page discovery panel for finding users and public projects, then forking public projects into your own space.
- Three-pane Discord-style project workspace with roles, online presence, bookmark management, and realtime collaboration.
- Bookmark modal with threaded comments, avatars, and resolution controls.
- Realtime project panel with start/end call flow, screen share, and role-aware call access.

## Local Setup

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` with at least:

```env
PORT=8000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
```

Optional, if you use Google login:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:8000/api/auth/google/callback
```

Start the backend:

```bash
cd backend
npm run dev
```

Health checks:

- `GET /` returns a basic service response.
- `GET /health` returns `{ "ok": true }`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend on `http://localhost:8000` by default through its API helper.

To verify the production build:

```bash
cd frontend
npm run build
```

## Main Features

- Public landing experience with product marketing pages.
- Auth flow with email/password and Google OAuth.
- Personal and collaborative project spaces.
- Role-based access control for collaborative projects.
- Realtime room presence, chat, reactions, cursor updates, screen share, and WebRTC calls.
- Bookmark/project-link saving with comments and comment resolution.
- Public project discovery and remix/fork workflow.
- Project lineage metadata for tracking ancestry and remix depth.
- Project graph, timeline, pulse, and invite surfaces.

## Key API Areas

- `/api/auth`
- `/api/projects`
- `/api/links`
- `/api/bookmarks`
- `/api/comments`
- `/api/invites`
- `/api/roles`
- `/api/search`
- `/api/remix`
- `/api/graph`
- `/api/lattice`
- `/api/timeline`
- `/api/pulse`

## Project Structure

```text
README.md
backend/
  index.js
  controllers/
  middlewares/
  models/
  routes/
  utils/
frontend/
  src/
  public/
  package.json
```

## Notes

- Socket.IO is configured for local development without extra credentials.
- Realtime room state is currently stored in memory on the server.
- Redis and TURN are still optional future upgrades for scaling and more reliable WebRTC connectivity.