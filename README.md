# LATTICE

LATTICE is a full-stack knowledge workspace that transforms passive bookmarking into an active, collaborative system.
Teams can collect links, discuss context, apply role-based access, track content evolution, and manage link lifecycle with biological decay mechanics.

## Product Overview

LATTICE is designed to solve three common problems in knowledge-heavy workflows:

1. Information overload from unstructured saved links.
2. Collaboration gaps between individuals and teams.
3. Loss of relevance when saved content is never revisited.

The platform combines AI-assisted metadata, collaborative project spaces, real-time communication, and lifecycle governance (decay and graveyard recovery) into one operational workspace.

## Screenshots

### Landing Experience

![LATTICE Landing Page](docs/screenshots/landing-page.png)

### Authentication Flow

![LATTICE Login](docs/screenshots/auth-login.png)

### Main Workspace Home

![LATTICE Home Dashboard](docs/screenshots/dashboard-home.png)

### Project Workspace

![LATTICE Project View](docs/screenshots/project-workspace.png)

## Core Features

### 1. Authentication and Identity

- Email/password registration and login.
- Google OAuth integration.
- Current-user profile endpoint for session hydration.
- Profile settings with bio, social links, and personal decay thresholds.

### 2. Project and Workspace Management

- Personal and collaborative project types.
- Per-project ownership and membership model.
- Visibility controls for public/private lattice discovery.
- Project lineage metadata for remixes and forks.

### 3. Bookmark Ingestion and Intelligence

- Add links directly into a selected project.
- Metadata enrichment pipeline (title/summary/media).
- Role-based or public access policies on links.
- Link comments and collaborative discussion threads.

### 4. Biological Decay and Graveyard Recovery

- Inactivity tracking per link.
- Decay window rendering between configured thresholds.
- Automatic transition from active -> decaying -> dead.
- Recoverable graveyard for deleted/expired links.
- Restore workflow to reactivate archived knowledge.

### 5. Roles and Access Governance

- Role definitions for collaborative projects.
- Owner-only role creation controls.
- Permission levels: full access, restricted access, view only.
- Role-aware link visibility and collaboration boundaries.

### 6. Fork and Activity System

- Public lattice discovery.
- Fork/remix of public projects.
- Forked lattice listing.
- Activity feed for:
  - forks created by you,
  - updates on your forks,
  - forks created from your projects.

### 7. Realtime Collaboration Layer

- Socket.IO rooms for live project presence.
- Live chat, reactions, and cursor telemetry.
- WebRTC signaling for call/collaboration panel.
- Redis-backed distributed synapse for cross-node realtime alignment.

## Technical Architecture

### Frontend

- React + Vite.
- Route-level protection for authenticated workspaces.
- Modular pages for Home, Projects, Graveyard, Activity, Settings.
- Shared API service layer with JWT-based authorization.

### Backend

- Node.js + Express APIs.
- MongoDB + Mongoose domain models.
- JWT authentication middleware.
- Controllers organized by feature domain.
- Socket.IO for bidirectional realtime events.
- Redis adapter for multi-instance realtime synchronization.

### Data Domains

- Users.
- Projects and project members.
- Roles and permissions.
- Links and access scopes.
- Invites.
- Comments and messages.
- Timeline/pulse/change insights.
- Remix lineage and activity.

## API Surface (High-Level)

- `/api/auth` - register/login/me/google auth.
- `/api/users` - profile and settings updates.
- `/api/projects` - create/list/membership.
- `/api/links` - create/list/view/delete/restore/graveyard.
- `/api/roles` - role creation and listing.
- `/api/invites` - project invitations.
- `/api/comments` - discussion comments.
- `/api/search` - spotlight and discovery.
- `/api/remix` - public projects, forking, lineage, activity.
- `/api/timeline` and `/api/pulse` - content evolution and summaries.
- `/api/graph` and `/api/lattice` - graph and lattice-level endpoints.

## Repository Structure

```text
.
|- backend/
|  |- controllers/
|  |- middlewares/
|  |- models/
|  |- routes/
|  |- services/
|  |- utils/
|  `- index.js
|- frontend/
|  |- src/
|  |  |- Pages/
|  |  |- components/
|  |  `- services/
|  `- index.html
|- docs/
|  `- screenshots/
`- README.md
```

## Local Development Setup

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=8000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://127.0.0.1:5173

# Optional OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:8000/api/auth/google/callback

# Optional distributed realtime (recommended for multi-node)
REDIS_URL=...
# or UPSTASH_REDIS_URL=...
# or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
```

Run backend:

```bash
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Build frontend:

```bash
npm run build
```

## Health and Verification

- `GET /` confirms backend service startup.
- `GET /health` returns `{ "ok": true }`.
- Frontend served at `http://127.0.0.1:5173` in local dev.

## Current Realtime Note

The project now includes a Redis distributed synchronization layer for realtime telemetry and cross-instance Socket.IO event propagation. In single-node local mode, it automatically falls back to in-memory behavior when Redis is not configured.