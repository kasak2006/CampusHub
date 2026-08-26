# CampusHub — Phase-Wise Build Guide (Phase 6+)

This continues [`02-phase-plan.md`](02-phase-plan.md) now that Phases 0–5 are complete
and the app is **deployed and live** (Vercel + Render + Atlas). Same rules apply:
each phase has a **Goal**, a **Tasks** checklist, and a **Done when** condition. Don't
start a phase until the previous one's "done when" is genuinely true.

**Guiding principle for this batch:** lean on infrastructure you already paid for.
Socket.io (persistent server), Cloudinary (image/file uploads), Recharts, and the
`protect`/`authorize` RBAC + `collegeId` scoping are all wired and verified. Every
phase below reuses at least one of them instead of adding new infrastructure.

The four `soon` stubs already visible in `client/src/components/Sidebar.jsx`
(**Announcements**, **Analytics**, **Settings**, **Help Center**) are closed out by
these phases.

---

## Phase 6: Announcements + Notifications (Real-Time)

**Goal:** A campus-wide communication layer. This is the smallest, highest-visibility
next step and it's almost pure reuse of the Socket.io setup from Phase 3. Every later
phase (assignments, discussions) rides on the notification layer built here, so do it
first.

**Why it matters:**
- *Students:* one live feed for "class cancelled", "event moved", "grades posted" — pushed, not buried in email.
- *Faculty / club leads:* broadcast once to exactly the right audience (a course, a club, or the whole college).

**Tasks:**
- [x] Build `Announcement` schema — `{ collegeId, scope: 'college'|'club'|'course', targetId, authorId, title, body, pinned, createdAt }`
- [x] Build `Notification` schema — `{ collegeId, userId, type, refId, text, link, read, createdAt }`, indexed on `{userId, read}` and `{userId, createdAt}`
- [x] Announcements API `/api/announcements` — list (scoped to what the caller can see), create, edit (title/body/pin), delete; per-scope permission checks in `announcementController.canPostTo` (club lead of that club / faculty of that course / faculty+admin for college), mirroring `clubController.js` / `courseController.js`
- [x] Notifications API `/api/notifications` — list own (+ unread count), `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all`
- [x] Socket.io: reuse `socket/index.js` — read the auth cookie on the handshake and auto-join a per-user room `user:${id}`; on announcement create, fan out a `notification` event + persist a `Notification` per recipient (`utils/notify.js`). *(Chose per-user rooms over `club:`/`course:` rooms: recipients are computed server-side and pushed directly, so the client never needs to know its own memberships to receive pushes.)*
- [x] Client `NotificationContext` — loads on login, keeps unread count live via the socket, pushes a toast (reuses `ToastContext`) for new arrivals; `services/socket.js` gains `subscribeToNotifications` + `reconnectSocket` (re-handshake so a same-session login joins the right user room)
- [x] Topbar notification bell (`Topbar.jsx`) — unread badge + dropdown list, mark-one-read on click, mark-all-read control
- [x] `Announcements` page — replaces the `soon` stub in `Sidebar.jsx`; composer visible only to roles that can post, audience select scoped to their led clubs / taught courses / (faculty+admin) college
- [x] Seed 3 demo announcements (college-wide + club + course scopes)

**Done when:** A faculty member posts a course announcement in one tab and an enrolled
student sees the bell badge increment and a toast appear **without refreshing** — same
live-update bar Phase 3 set for registration counts. A student cannot post a
college-wide announcement (403). ✅ **Verified live against Atlas:** faculty posted a
college-wide announcement via the API while the student was logged in the browser — the
bell went to "1 unread" with no refresh, the dropdown showed the notification, mark-all-read
cleared it and persisted (`unreadCount: 0`, `read: true` server-side); scoping confirmed
(student saw college + enrolled-course announcements but not the club they hadn't joined);
students got 403 posting to `college` and to a club they don't lead. Lint clean.

---

## Phase 7: Assignments, Submissions & Grades ✅ DONE

> **Completed & verified** (2026-08-25) — full build plan, task checklist, and live-verification
> notes in [07-phase-plan.md](07-phase-plan.md). Summary below kept for context.

**Goal:** Close the coursework loop — the single biggest jump in real usefulness. Bolts
directly onto the existing `Course` model and reuses the one-doc-per-pair pattern from
`Registration` / `AttendanceRecord`, plus Cloudinary for file uploads.

**Why it matters:**
- *Students:* see what's due, submit text or a file, get grades + feedback in one place.
- *Faculty:* a submission inbox per assignment, grade inline, auto-flag late submissions (reuse the late/`dateKey` logic already in the attendance module).

**Tasks:**
- [ ] Build `Assignment` schema — `{ collegeId, courseId, title, description, dueAt, points, attachments[], createdBy }`
- [ ] Build `Submission` schema — `{ collegeId, assignmentId, studentId, text, fileUrl, submittedAt, grade, feedback, status: 'submitted'|'late'|'graded' }`, unique `{assignmentId, studentId}` index (one submission per student per assignment)
- [ ] Generalize `utils/uploadImage.js` → `uploadFile` (accept PDF/doc/zip data-URIs, keep the graceful fallback when Cloudinary is unconfigured)
- [ ] Assignment API — `GET/POST /api/courses/:id/assignments`, `GET/PATCH/DELETE /api/assignments/:id`; create/edit gated to the course's `facultyId` or admin (same check as `courseController`)
- [ ] Submission API — `POST /api/assignments/:id/submissions` (student, sets `status` late if past `dueAt`), `GET /api/assignments/:id/submissions` (faculty roster), `PATCH /api/submissions/:id/grade` (faculty)
- [ ] Frontend: assignment list + "add assignment" on `CourseDetail`; student submission page; faculty grading roster page
- [ ] Gradebook view — per-course grade summary; reuse Recharts for a simple grade distribution
- [ ] Fire a Phase 6 notification on assignment-created (to enrolled students) and on graded (to that student)
- [ ] Seed one assignment on CS-301 with a couple of submissions (one graded, one late)

**Done when:** Faculty creates an assignment with a due date; an enrolled student submits
a file before the deadline and another submits after (auto-flagged late); faculty grades
both with feedback; each student sees their grade + feedback and gets a notification. All
ownership rules enforced at the API, not just the UI.

---

## Phase 8: Unified Calendar + Resource Library

**Goal:** Tie all the dates together and give courses a materials tab. The calendar needs
**no new core models** — it aggregates data three modules already produce.

**Why it matters:**
- *Students:* one screen answers "what's happening / what's due this week" — registered events, class sessions, assignment deadlines.
- *Faculty:* drop lecture slides/notes where students already look.

**Tasks:**
- [ ] Calendar API `GET /api/calendar?from=&to=` — merge, for the current user: their registered `Event`s, `AttendanceSession`s for enrolled/taught courses, and `Assignment` due dates; return a normalized `{ type, title, when, refId, url }[]`
- [ ] Frontend calendar page — month/week grid (hand-rolled, or `react-big-calendar` if bundle budget allows); color-coded by type; click → deep-link to the source record
- [ ] Build `Resource` schema — `{ collegeId, courseId, title, fileUrl, type, uploadedBy }`
- [ ] Resources API — `GET/POST /api/courses/:id/resources`, `DELETE /api/resources/:id`; upload via the generalized `uploadFile` from Phase 7; upload gated to course faculty/admin
- [ ] Frontend: a "Materials" tab on `CourseDetail` — list + upload (faculty) / download (students)
- [ ] Add "Calendar" to the sidebar Overview nav

**Done when:** A student opens the calendar and sees an event they registered for, a class
session, and an assignment due date all in one view, each clickable to its source page. A
faculty member uploads a PDF to a course and an enrolled student can download it.

---

## Phase 9: Community — Q&A / Discussion (Real-Time)

**Goal:** Threaded discussion scoped to a course or club. Reuses Socket.io rooms again
and the notification layer from Phase 6.

**Why it matters:**
- *Students:* ask questions without emailing; searchable, so the same question isn't asked twice; upvote helpful answers.
- *Faculty / leads:* answer once for everyone; endorse the best answer as "resolved".

**Tasks:**
- [ ] Build `Thread` schema — `{ collegeId, scope: 'club'|'course', targetId, authorId, title, tags[], resolved, createdAt }`
- [ ] Build `Post` schema — `{ collegeId, threadId, authorId, body, votes, isAnswer, createdAt }`
- [ ] Threads/Posts API — list threads by scope, create thread, reply, upvote (idempotent per user), mark a post as the accepted answer / thread resolved (author or faculty/lead)
- [ ] Real-time: emit new-reply into the thread's room so an open thread updates live
- [ ] Notify thread author (Phase 6) on new reply; notify when their thread is answered
- [ ] Frontend: discussion tab on `CourseDetail` and `ClubDetail`; thread list, thread view with replies, composer, vote buttons, "resolved" badge
- [ ] Basic search/filter over threads (title + tags)

**Done when:** A student posts a question on a course; a peer and the faculty member reply;
replies appear live in an open thread; the asker (or faculty) marks the accepted answer and
the thread shows as resolved.

---

## Phase 10: Analytics + Admin Panel

**Goal:** Close the last two `soon` stubs (Analytics, Settings). Aggregation-heavy, like
Phase 4's analytics — reuse the `$group` pipeline approach and Recharts.

**Why it matters:**
- *Faculty:* a cross-course view — at-risk students, submission and attendance trends in one dashboard instead of per-course.
- *Admin:* run the campus — manage users/roles, bulk-enroll, and see engagement (active users, club growth, event turnout).

**Tasks:**
- [ ] Faculty analytics page — aggregate across all courses the faculty owns: at-risk students (low attendance *and/or* missing submissions), per-course trend tiles; reuse Recharts + `$group` pipelines
- [ ] Admin console — user list with search/filter, change role, deactivate; all gated by `authorize('admin')`
- [ ] Bulk enrollment — CSV upload to enroll students into a course by email (validate + report failures)
- [ ] Campus engagement dashboard — active users, new clubs over time, event attendance rate, announcement reach
- [ ] Settings page — college-level defaults (attendance threshold, feature toggles); replaces the admin `soon` stub
- [ ] (Optional) Help Center stub → a simple static FAQ page to close the student `soon` item

**Done when:** A faculty member sees at-risk students across all their courses from one page
(driven by aggregation, not client loops); an admin changes a user's role and bulk-enrolls a
CSV of students into a course, both reflected immediately.

---

## Smaller high-impact wins (drop in between phases)

These are self-contained and can slot in whenever, independent of the phase order:

- [ ] **QR event check-in** — generate a QR per registration; a lead scans at the door to record real attendance vs. registration. Reuses Events; adds a QR lib.
- [ ] **Event feedback / surveys** — post-event rating + comments for leads; small `Feedback` model.
- [ ] **Global search / ⌘K command palette** — jump to any club, event, or course fast; queries existing data.
- [ ] **Gamification** — participation points + badges (join a club, attend an event, answer a question); rides on the Phase 6 notification infra.

---

## Deferred (from the original vision, still not scoped)

Tracked in [`01-project-overview.md`](01-project-overview.md) §8 — revisit after Phase 10:
Lost & Found, Opportunities/Internships board, Campus marketplace, Campus-wide social feed,
and **multi-college / multi-tenant support** (the structural one — every model already
carries `collegeId`, so this is a scoping + onboarding change, not a rewrite).

---

## How to Use This Guide

- Same as the Phase 0–5 guide: treat each checklist literally, and don't advance until the "done when" is genuinely true.
- **Recommended order:** Phase 6 first (small, closes a stub, builds the notification layer everything else reuses), then Phase 7 (biggest usefulness jump). Phases 8–10 can be reordered to taste.
- Each phase still follows the house pattern: **schema → API (with RBAC) → frontend → real-time (if needed) → seed/demo data → verify live**.
