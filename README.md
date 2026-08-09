# CampusHub

An all-in-one digital campus ecosystem that connects students, faculty, clubs, and
administration in one place. Built single-college for now, with a data model designed
to extend to multi-college later (every record carries a `collegeId`).

See [`01-project-overview.md`](01-project-overview.md) and
[`02-phase-plan.md`](02-phase-plan.md) for full scope and the phased build guide.

## Tech Stack

| Layer        | Choice                     |
| ------------ | -------------------------- |
| Frontend     | React (Vite)               |
| Backend      | Node.js + Express          |
| Database     | MongoDB (Mongoose)         |
| Real-time    | Socket.io                  |
| File storage | Cloudinary                 |
| Auth         | JWT (httpOnly cookie)      |
| Charts       | Recharts                   |

## Repository Structure

```
CampusHub/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── components/     # Reusable UI
│       ├── pages/          # Route-level views
│       ├── context/        # Context API state (AuthContext)
│       └── services/       # api.js (axios) + socket.js
├── server/                 # Express backend
│   └── src/
│       ├── config/         # env, db, cloudinary
│       ├── routes/         # API routers (mounted under /api)
│       ├── controllers/    # Route handlers (per phase)
│       ├── models/         # Mongoose schemas (per phase)
│       ├── middleware/     # auth (protect/authorize), error handling
│       ├── socket/         # Socket.io setup + handlers
│       └── utils/          # Shared helpers
└── package.json            # Monorepo scripts (concurrently)
```

## Prerequisites

- Node.js 18+ (tested on v22)
- A MongoDB connection string (local, or a free MongoDB Atlas cluster)
- A Cloudinary account (optional until file uploads land in Phase 1+)

## Setup

1. **Install dependencies** (root, server, and client):

   ```bash
   npm run install:all
   ```

2. **Configure environment variables.** Copy each example file and fill it in:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   At minimum set `MONGO_URI` and `JWT_SECRET` in `server/.env`.

3. **Run both apps together** (from the repo root):

   ```bash
   npm run dev
   ```

   - Server → http://localhost:5000 (health check at `/api/health`)
   - Client → http://localhost:5173

   The Vite dev server proxies `/api` and `/socket.io` to the backend, so no CORS
   fuss in development.

## Phase 0 — "Done When" Check

Open http://localhost:5173. The landing page shows three status cards. When all
three are green, the Phase 0 foundation is solid:

1. ✅ **React** — the frontend rendered
2. ✅ **Express API** — `GET /api/health` returned OK (and reports DB status)
3. ✅ **Socket.io** — the real-time channel connected

> Note: the Express API card reports the DB state. If MongoDB isn't connected yet,
> the server still runs so you can verify the API — the card will show `db: disconnected`.

## Scripts

| Command                | Where | Description                              |
| ---------------------- | ----- | ---------------------------------------- |
| `npm run dev`          | root  | Run server + client together             |
| `npm run install:all`  | root  | Install deps in root, server, and client |
| `npm run lint`         | root  | Lint both packages                       |
| `npm run dev`          | server| Nodemon-watched Express server           |
| `npm run seed`         | server| Seed faculty/admin/student test accounts |
| `npm run dev`          | client| Vite dev server                          |

### Seeded test accounts

Run `npm run seed` from `server/` (idempotent). It creates accounts for
testing role-aware dashboards, plus a demo `Coding Club` (led by the club lead,
with a pending join request from the student) so the Phase 2 flow is testable
immediately:

| Role      | Email                     | Password      |
| --------- | ------------------------- | ------------- |
| Faculty   | `faculty@campushub.test`  | `faculty123`  |
| Admin     | `admin@campushub.test`    | `admin123`    |
| Student   | `student@campushub.test`  | `student123`  |
| Club Lead | `clublead@campushub.test` | `clublead123` |

New students can also self-register at `/register`.

## Build Roadmap

- [x] **Phase 0** — Project architecture & setup (this scaffold)
- [x] **Phase 1** — Auth & spine (User schema, JWT, RBAC, role-aware dashboards)
- [x] **Phase 2** — Clubs module (Club + join-request schemas, CRUD API, join/approve flow, self-service club creation)
- [x] **Phase 3** — Events module (Event + Registration schemas, atomic capacity + waitlist, Socket.io live registration counts)
- [ ] **Phase 4** — Attendance module
- [ ] **Phase 5** — Polish & integration + deploy
