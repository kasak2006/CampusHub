# CampusHub

An all-in-one digital campus ecosystem that connects students, faculty, clubs, and
administration in one place. Built single-college for now, with a data model designed
to extend to multi-college later (every record carries a `collegeId`).

See [`01-project-overview.md`](01-project-overview.md) and
[`02-phase-plan.md`](02-phase-plan.md) for full scope and the phased build guide.

## Features

- **Auth & roles** — student / club_lead / faculty / admin, JWT in an httpOnly cookie, RBAC enforced at the route level, and a role-aware dashboard.
- **Clubs** — self-service club creation (creator auto-becomes lead), join requests with lead approval, and member/lead management.
- **Events (real-time)** — club events with **atomic capacity handling** (no oversell), an automatic FIFO **waitlist**, and a **live registration count** that updates across tabs over Socket.io — no refresh.
- **Attendance** — faculty create courses, enroll students by email, and mark sessions present/late/absent. Students see their attendance % per course; faculty get **aggregation-driven analytics** (per-student %, below-threshold flagging, and a **Recharts** trend chart).
- **Polish** — toast notifications, light/dark themes, a responsive app shell, and a one-command seed for instant demo data.

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

Run `npm run seed` from `server/` (idempotent). It creates the accounts below
plus demo content so every module is testable immediately:

- a `Coding Club` (led by the club lead, with a pending join request from Sam),
- a `Hackathon Kickoff` event (capacity 2, to exercise the live count + waitlist),
- a `CS-301 Data Structures` course with four enrolled students and four marked
  attendance sessions (Priya is seeded below the 75% threshold so the analytics
  flag and trend chart aren't empty).

| Role      | Email                     | Password      |
| --------- | ------------------------- | ------------- |
| Faculty   | `faculty@campushub.test`  | `faculty123`  |
| Admin     | `admin@campushub.test`    | `admin123`    |
| Student   | `student@campushub.test`  | `student123`  |
| Club Lead | `clublead@campushub.test` | `clublead123` |
| Student   | `nina@campushub.test`     | `student123`  |
| Student   | `omar@campushub.test`     | `student123`  |
| Student   | `priya@campushub.test`    | `student123`  |

New students can also self-register at `/register`.

## Deployment

The app deploys as two services against a MongoDB Atlas database: the Express
API on **Render** (blueprint in [`render.yaml`](render.yaml)) and the Vite
frontend on **Vercel** ([`client/vercel.json`](client/vercel.json)). They live on
different domains, so the auth cookie is issued `SameSite=None; Secure` in
production (see `server/src/utils/generateToken.js`) and CORS/Socket.io are
locked to `CLIENT_ORIGIN`.

1. **MongoDB Atlas** — create a free cluster, add a database user, and allow
   network access (`0.0.0.0/0` for a demo). Copy the connection string.
2. **Backend (Render)** — New → Blueprint → select this repo. Render reads
   `render.yaml`; fill in the prompted secrets: `MONGO_URI`, `CLIENT_ORIGIN`
   (your Vercel URL, set after step 3 — you can update it later), and optionally
   the Cloudinary keys. `JWT_SECRET` is generated for you. Note the service URL,
   e.g. `https://campushub-api.onrender.com`.
3. **Frontend (Vercel)** — New Project → import this repo → set **Root
   Directory** to `client`. Add env vars `VITE_API_BASE_URL` and
   `VITE_SOCKET_URL`, both set to your Render URL from step 2. Deploy.
4. **Wire them up** — set the backend's `CLIENT_ORIGIN` to the Vercel URL and
   redeploy. Then seed the production DB: `MONGO_URI=<atlas> npm run seed` from
   `server/` locally.

> Free Render web services sleep when idle — the first request after a nap takes
> a few seconds to wake. That's expected on the free tier.

## Build Roadmap

- [x] **Phase 0** — Project architecture & setup (this scaffold)
- [x] **Phase 1** — Auth & spine (User schema, JWT, RBAC, role-aware dashboards)
- [x] **Phase 2** — Clubs module (Club + join-request schemas, CRUD API, join/approve flow, self-service club creation)
- [x] **Phase 3** — Events module (Event + Registration schemas, atomic capacity + waitlist, Socket.io live registration counts)
- [x] **Phase 4** — Attendance module (Course/Session/Record schemas, faculty marking, aggregation analytics + Recharts trend)
- [x] **Phase 5** — Polish & integration (toast notifications, cross-origin-ready auth, deploy config, README)
