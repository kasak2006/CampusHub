# CampusHub — Project Overview

## 1. Objective

To build a centralized digital platform that connects students, faculty, clubs, and college administration, bringing different aspects of campus life into one place.

## 2. Aim

Solve the problem of fragmented college communication and services. Instead of students juggling different platforms for announcements, events, clubs, attendance, and opportunities, CampusHub provides a single digital ecosystem for campus life.

## 3. One-Line Pitch

> CampusHub is an all-in-one digital campus ecosystem that simplifies communication, collaboration, opportunities, and everyday student life for a college community.

## 4. Scope for Current Build

CampusHub is being built **single-college** for now, with the data model designed so it *could* extend to multi-college later without a rewrite (every record carries a `collegeId`, even though it's hardcoded to one value today).

**Locked-in modules for initial build:**

1. **Events + Clubs** — clubs create events, students register in real time, club membership management
2. **Attendance** — faculty marks attendance, students view their %, faculty get basic analytics

Other modules from the original vision (timetable, opportunities board, lost & found, marketplace, social feed, announcements) are **planned but deferred** — see Section 7.

## 5. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (MERN) |
| Backend | Node.js + Express |
| Database | MongoDB |
| Real-time | Socket.io |
| File storage | Cloudinary |
| Auth | JWT |
| Charts (faculty analytics) | Recharts |

## 6. User Roles

| Role | Description | Core capabilities |
|---|---|---|
| **Student** | Default user role | View/join clubs, register for events in real time, view own attendance % |
| **Club Lead** | A student elevated to manage one or more clubs | Everything a student can do, plus: create/manage events for their club(s), approve/reject club join requests, view live registration counts |
| **Faculty** | Teaching staff | Mark attendance per course/session, view attendance analytics (per-student %, below-threshold list) |
| **Admin** | College-level administrator | Full oversight (scope grows as more modules are added — see Phase docs) |

**Role notes:**
- A single `User` document holds a `role` field. `club_lead` is not a separate collection — it's a role assigned to a student who leads one or more clubs (tracked via `Club.leadIds`).
- Role-based access control (RBAC) is enforced at the API route level, not just hidden in the UI.

## 7. Feature List (Current Scope)

### Spine (shared across all modules)
- [ ] Authentication (signup/login, JWT-based sessions)
- [ ] Role-based routing and access control
- [ ] Shared app shell/layout (nav, role-aware dashboard)

### Module: Events + Clubs
- [ ] Club CRUD (create, view, edit club profile — logo, description)
- [ ] Club membership: join requests, approve/reject by club lead
- [ ] Event CRUD (club lead creates/edits/cancels events)
- [ ] Event registration (students register/cancel)
- [ ] **Real-time registration counts** via Socket.io
- [ ] Capacity handling (waitlist when full, race-condition-safe)

### Module: Attendance
- [ ] Course/Class setup (faculty owns a course, has enrolled student list)
- [ ] Attendance session creation + marking (present/absent/late)
- [ ] Student view: attendance % per course
- [ ] Faculty analytics: per-student %, below-threshold list, attendance trend chart

## 8. Deferred Modules (Future Phases, Not Yet Scoped in Detail)

These remain part of the long-term vision but are **not** part of the current phase plan:

- Announcements feed
- Timetable
- Internships / opportunities board
- Lost & Found
- Campus marketplace
- Campus-wide social feed
- Multi-college / multi-tenant support

## 9. Document Index

- `01-project-overview.md` — this file
- `02-phase-plan.md` — phase-by-phase build guide
