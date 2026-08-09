# CampusHub — Phase-Wise Build Guide

This document breaks the build into sequential phases. Each phase has a clear goal, a checklist, and a "done when" condition so you know when to move on. Don't start a phase until the previous one's "done when" is true — resist the urge to jump ahead to the fun real-time stuff before the spine is solid.

---

## Phase 0: Project Architecture & Setup

**Goal:** Lock in the technical foundation before writing feature code.

**Tasks:**
- [ ] Decide repo structure: monorepo (`/client`, `/server`) vs separate repos
- [ ] Initialize backend: Express app, folder structure (`routes/`, `controllers/`, `models/`, `middleware/`, `config/`)
- [ ] Initialize frontend: React app (Vite recommended over CRA), folder structure (`components/`, `pages/`, `context/` or state solution, `services/` for API calls)
- [ ] Set up MongoDB (Atlas free tier is fine) and confirm connection from Express
- [ ] Set up environment variables (`.env`) for both client and server — DB URI, JWT secret, Cloudinary keys
- [ ] Set up Cloudinary account, test one upload manually via API
- [ ] Set up Socket.io server skeleton (just a connection log, no events yet)
- [ ] Decide state management approach on frontend (Context API is enough for this scope; Redux is likely overkill)
- [ ] Set up ESLint/Prettier for consistency
- [ ] Push initial skeleton to GitHub, confirm client and server both run locally

**Done when:** You have a running React app that can hit a "hello world" Express route, Socket.io connects (check browser console), and MongoDB is connected — all confirmed working before any real feature exists.

---

## Phase 1: Auth & Spine

**Goal:** Every other phase depends on this. Get roles and access control right now.

**Tasks:**
- [ ] Build `User` schema (see overview doc for fields)
- [ ] Signup route (student signup at minimum; faculty/admin can be seeded manually for now)
- [ ] Login route, JWT issuance
- [ ] Auth middleware (`protect`) — verifies JWT, attaches `req.user`
- [ ] Role-check middleware (`authorize('faculty', 'admin')` style) — reusable across routes
- [ ] Frontend: login/signup pages, store JWT (httpOnly cookie preferred over localStorage), protected route wrapper
- [ ] Role-aware dashboard shell — student, club_lead, faculty, admin each see a different landing view (even if mostly empty right now)
- [ ] Basic profile view/edit (name, avatar upload via Cloudinary — good first test of your upload pipeline)

**Done when:** You can sign up as a student, log in, get redirected to a role-appropriate dashboard, and a faculty-seeded account sees a *different* dashboard. Hitting a protected route without a token fails correctly.

---

## Phase 2: Clubs Module

**Goal:** Clubs exist and have members, before events are layered on top.

**Tasks:**
- [x] Build `Club` schema
- [x] Club CRUD API (**decision: self-service creation** — any authed user can create a club and auto-becomes its first lead; edit/delete restricted to that club's leads or admin)
- [x] Club listing + detail page (frontend)
- [x] Club logo upload via Cloudinary (data-URI or URL; graceful fallback when unconfigured)
- [x] `ClubJoinRequest` schema + API (student requests to join, club lead approves/rejects)
- [x] Club lead dashboard: pending requests list, member list (on the club detail page)
- [x] Promote a student to `club_lead` role for a specific club (automatic on creation via `syncLeadRole`, plus admin/lead `POST /:id/leads`)

**Done when:** A club lead can create a club, a student can request to join, the club lead can approve it, and the student then shows up in the club's member list.

---

## Phase 3: Events Module (Real-Time Core)

**Goal:** This is your flagship real-time feature — give it real time and attention.

**Tasks:**
- [x] Build `Event` and `Registration` schemas
- [x] Event CRUD API (create/edit/cancel — restricted to club lead of that club, enforced against `Club.leadIds`)
- [x] Event banner upload via Cloudinary (reuses `utils/uploadImage.js`)
- [x] Event listing + detail page (public to all logged-in users)
- [x] Registration API — student registers/cancels
- [x] **Atomic capacity handling**: conditional `$inc` with `$expr:{$lt:['$registeredCount','$capacity']}` — verified via a concurrent 3-way race for the last seat (never oversold)
- [x] Waitlist logic when event is full (FIFO promotion on cancel / capacity increase — verified)
- [x] Socket.io: room-per-event (`event:${eventId}`), emit `registrationUpdate` on register/cancel/edit/cancel-event
- [x] Frontend: live-updating registration count on event detail page (verified live across two tabs, no refresh)
- [x] Club lead view: live registration roster on the event detail page

**Done when:** Open the same event page in two browser tabs, register in one, and watch the count update in the other **without refreshing**. Test the capacity edge case (rapid concurrent registrations near the cap) at least manually.

---

## Phase 4: Attendance Module

**Goal:** A data-integrity-focused module — different muscle than Phase 3's real-time work.

**Tasks:**
- [ ] Build `Course`, `AttendanceSession`, `AttendanceRecord` schemas
- [ ] Course creation API (faculty creates a course, enrolls students — manual add or CSV/list for now)
- [ ] Attendance session creation (faculty picks a course + date)
- [ ] Marking UI: faculty sees enrolled student list, marks present/absent/late, submits
- [ ] Prevent duplicate sessions for the same course+date (or handle edit-existing-session gracefully)
- [ ] Student view: attendance % per enrolled course
- [ ] Faculty analytics: aggregation pipeline for per-student %, list of students below a threshold (e.g. 75%)
- [ ] Faculty analytics: simple trend chart (Recharts) of daily/weekly attendance % for a course

**Done when:** A faculty member can mark attendance for a session, a student immediately sees an updated %, and the faculty dashboard correctly flags below-threshold students using a real aggregation query (not a client-side loop).

---

## Phase 5: Polish & Integration

**Goal:** Make the two modules feel like one product, not two bolted-together demos.

**Tasks:**
- [ ] Consistent UI/UX pass across both modules (shared components, spacing, color system)
- [ ] Error handling and loading states everywhere (no silent failures)
- [ ] Input validation on both frontend and backend (don't trust the client)
- [ ] Basic notifications: e.g. "You're registered!" toast, "Attendance marked" confirmation
- [ ] Mobile-responsive check
- [ ] Seed script for demo data (sample clubs, events, courses, students) so you can demo instantly
- [ ] Basic README with setup instructions
- [ ] Deploy: backend (Render/Railway), frontend (Vercel/Netlify), MongoDB Atlas — confirm Socket.io works across the deployed environment (this trips people up — check CORS and websocket support on your host)

**Done when:** A stranger can clone the repo, follow your README, and get a working local instance — and you have a deployed link that demonstrates both modules end-to-end, including the real-time registration count working live.

---

## Phase 6+: Future Modules (Not Yet Detailed)

Once Phases 0–5 are solid, revisit the deferred modules list in the overview doc and repeat this same pattern for each: schema → API → frontend → real-time (if needed) → polish. Suggested next candidates, in rough order of standalone value:

1. Announcements feed (fairly quick, high visible impact — reuses your Socket.io setup)
2. Lost & Found (good file-upload + search practice)
3. Opportunities board (mostly CRUD, low complexity)
4. Marketplace (adds a "contact/chat" wrinkle)
5. Social feed (highest complexity — consider whether it's needed at all)
6. Multi-college support (structural change — revisit the `collegeId` scoping notes in the overview doc)

---

## How to Use This Guide

- Treat each phase's checklist as a literal checklist — check items off as you go
- Don't move to the next phase until the "done when" condition is genuinely true, not "mostly working"
- If a phase is taking much longer than expected, that's a signal to cut scope *within* the phase, not to skip ahead
