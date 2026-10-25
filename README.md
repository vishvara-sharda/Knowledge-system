# Dynamic Node-Based Knowledge Workspace

A minimal, high-performance, dark-mode-first personal knowledge graph where nodes represent pieces of information and connections represent relationships between ideas. Built with **React**, **TypeScript**, **React Flow (`@xyflow/react`)**, and persistent **Cloudflare D1 (SQLite)** via a unified **Cloudflare Workers** backend.

---

## 📑 Table of Contents

1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Database Schema & Migrations](#database-schema--migrations)
5. [Local Development (Zero-Cost, Offline-Ready)](#local-development)
6. [Cloudflare Account & D1 Production Deployment](#cloudflare-account--d1-production-deployment)
7. [Troubleshooting & npm `ECOMPROMISED` Fix](#troubleshooting--npm-ecompromised-fix)
8. [Automated Testing](#automated-testing)
9. [Performance & Scalability](#performance--scalability)

---

## ✨ Features

- **Pannable & Zoomable Canvas**: Interactive graph powered by React Flow with smooth bezier/smoothstep connection edges and customizable background grids (dots, lines, cross).
- **Persistent Knowledge Nodes**:
  - Stable UUID identifiers.
  - Multi-handle omnidirectional connection points (Top, Bottom, Left, Right).
  - Customizable color accents (Indigo, Blue, Emerald, Amber, Pink, Purple, Slate).
  - Star favorites with instant filtering.
  - Multiline notes and expandable markdown descriptions.
  - Category tags with node count tracking.
- **Many-to-Many Connections**:
  - Independent database records linking source and target nodes.
  - Optional relationship labels (e.g., *relates to*, *depends on*, *causes*).
  - Drag handle-to-handle connection creation.
  - Duplicate and invalid connection prevention.
  - Disconnect nodes without deleting either node.
- **Right Detail Panel**:
  - Opens on node selection.
  - Edit title and notes with real-time blur/debounce autosave.
  - Tag manager with suggested workspace tags.
  - Connected nodes list with incoming and outgoing relationships.
  - "Jump to Node" action to smoothly pan/zoom camera to connected nodes.
  - Quick-connect selector to link with other nodes.
- **Left Sidebar**:
  - Workspace switcher and creator.
  - Live search input with real-time query matching and canvas glow highlighting.
  - Tabs: *All Nodes*, *Favorites*, *Recent*, *Tags & Categories*, and *Trash*.
  - Soft-delete recovery and permanent purge controls.
  - Canvas settings: toggle minimap, snap-to-grid, and grid styles.
- **Debounced Autosave & Persistence**:
  - Debounced batch position updates (`/api/nodes/batch-positions`) during node dragging to eliminate request flooding.
  - Immediate persistence for discrete actions (node creation, tag edits, connection changes).
  - Visual status pill: `Saving...`, `All changes saved`, or `Save failed (Retry)`.
  - Viewport camera persistence (zoom, pan x, y) restored on page reload.
- **History & Undo/Redo**: Full undo (`Ctrl+Z`) and redo (`Ctrl+Y`) stack for canvas operations.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 19 + TypeScript | Component-driven architecture |
| **Canvas** | `@xyflow/react` (v12) | High-performance graph visualization |
| **Styling** | Tailwind CSS v4 | Dark-mode-first aesthetic with glassmorphism |
| **Icons** | `lucide-react` | Clean icon system |
| **Backend** | Cloudflare Workers | Serverless edge API router |
| **Database** | Cloudflare D1 (SQLite) | Relational SQL database with foreign keys |
| **Build & Dev** | Vite 8 + `@cloudflare/vite-plugin` | Unified dev server & production bundling |

---

## 🏛️ Architecture Overview

```mermaid
graph TD
    Client["Browser (React + React Flow UI)"]
    ViteServer["Vite Dev Server (Port 5173)"]
    Worker["Cloudflare Worker API (/api/*)"]
    D1["Cloudflare D1 SQLite Database"]
    
    Client -->|HTTP / REST API| ViteServer
    ViteServer -->|@cloudflare/vite-plugin| Worker
    Worker -->|Prepared SQL Statements| D1
```

- In development, `@cloudflare/vite-plugin` integrates Miniflare and the Cloudflare Worker runtime directly into the Vite dev server on port `5173`.
- All requests to `/api/*` are intercepted by `src/worker/index.ts` and interact with the local SQLite database in `.wrangler/state/v3/d1`.
- In production, static assets are served from `dist/client` and the Worker backend runs at the edge.

---

## 💾 Database Schema & Migrations

The database migration is located in [`migrations/0001_initial_schema.sql`](file:///c:/Users/shard/OneDrive/Desktop/Nodes_database/node-website/migrations/0001_initial_schema.sql).

### Tables

1. **`workspaces`**: Multi-tenant workspace separation.
   - `id` (TEXT PRIMARY KEY), `name` (TEXT), `created_at`, `updated_at`
2. **`nodes`**: Persistent node entities.
   - `id` (TEXT PRIMARY KEY), `workspace_id` (FOREIGN KEY), `title`, `content`, `position_x`, `position_y`, `width`, `height`, `color`, `is_favorite`, `is_deleted`, `created_at`, `updated_at`
3. **`connections`**: Many-to-many relationship graph edges.
   - `id` (TEXT PRIMARY KEY), `workspace_id` (FOREIGN KEY), `source_node_id` (FOREIGN KEY), `target_node_id` (FOREIGN KEY), `relationship` (TEXT), `created_at`
4. **`tags`**: Category labels within workspaces.
   - `id` (TEXT PRIMARY KEY), `workspace_id` (FOREIGN KEY), `name`, `created_at`
5. **`node_tags`**: Join table enforcing referential integrity.
   - `node_id` (FOREIGN KEY), `tag_id` (FOREIGN KEY), PRIMARY KEY (`node_id`, `tag_id`)
6. **`workspace_settings`**: Viewport camera persistence.
   - `workspace_id` (PRIMARY KEY), `viewport_x`, `viewport_y`, `zoom`, `updated_at`

---

## 🚀 Local Development

Local development requires **no Cloudflare login** and **no paid cloud resources**.

### 1. Install Dependencies
```bash
cd node-website
npm install
```

### 2. Apply Local D1 Database Migration
```bash
npm run db:migrate:local
```
*(This sets up your local SQLite database in `.wrangler/state/v3/d1`)*

### 3. Start Development Server
```bash
npm run dev
```
Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

---

## ☁️ Cloudflare Account & D1 Production Deployment

Cloudflare D1 and Workers provide a generous **free tier** (100,000 requests/day, 5M rows read/day, 100k rows written/day, 5GB storage) that easily handles thousands of knowledge nodes.

### Step 1: Authenticate with Cloudflare
From inside `node-website`, run:
```bash
npx wrangler login
```
*(This opens a browser window for Cloudflare OAuth authorization).*

### Step 2: Create a Cloudflare D1 Database
```bash
npx wrangler d1 create nodes_db
```
The command will output the database binding configuration, for example:
```jsonc
{
  "binding": "DB",
  "database_name": "nodes_db",
  "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Step 3: Update `wrangler.jsonc`
Replace `nodes_db_local` in `wrangler.jsonc` with your remote `database_id`:
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "nodes_db",
      "database_id": "your-uuid-from-step-2"
    }
  ]
}
```

### Step 4: Apply Schema Migration to Remote D1
```bash
npm run db:migrate:remote
```

### Step 5: Build & Deploy
```bash
npm run deploy
```
Wrangler will output the live public URL of your worker application (e.g. `https://nodes-database-worker.yourname.workers.dev`).

---

## 🔧 Troubleshooting & npm `ECOMPROMISED` Fix

If you encountered:
```
npm error code ECOMPROMISED
npm error Lock compromised
```
when running `npx wrangler login` in the root folder, this occurs because:
1. `wrangler` is already installed inside `node-website/node_modules`. Running `npx` from outside that directory prompted npm to download a temporary version, conflicting with an existing file lock in `AppData\Local\npm-cache`.
2. Windows OneDrive folder synchronization occasionally holds a lock on npm cache files.

### Solution:
1. Clear the npm cache:
   ```powershell
   npm cache clean --force
   ```
2. Always run wrangler commands from within the `node-website` directory:
   ```powershell
   cd node-website
   npx wrangler login
   ```

---

## 🧪 Automated Testing

An automated integration test suite is included in `tests/api.test.ts`. It verifies all 14 acceptance criteria against the live SQLite D1 backend:

```bash
npm run test
```

### Tests Covered:
- Workspace creation and listing.
- Node creation with tags and positioning.
- Node metadata, title, and content updates.
- Batch position updates (simulating drag autosave).
- Many-to-many connections with custom relationship labels.
- Duplicate connection prevention (HTTP 409).
- Keyword search across titles and notes.
- Camera viewport settings persistence.
- Full workspace graph retrieval and restoration.
- Connection deletion without node deletion.
- Cascade referential integrity (deleting a node removes its connections while keeping unrelated nodes intact).

---

## 📈 Performance & Scalability

- **Batching**: Node movement updates are debounced by 600ms and batched via parameterized SQL statements (`env.DB.batch`), keeping network overhead minimal.
- **Indexes**: Indexed foreign keys on `workspace_id`, `source_node_id`, and `target_node_id` ensure O(1) connection lookups even with thousands of nodes.
- **Referential Integrity**: Cascading foreign keys ensure orphaned connections and tags are cleaned up automatically by SQLite without manual reconciliation.
