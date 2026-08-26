# CampusHub — Phase 7 Build Plan: Assignments, Submissions & Grades

Detailed build plan for **Phase 7** (expanded from the summary in
[`06-phase-plan.md`](06-phase-plan.md)). Same house rules as
[`02-phase-plan.md`](02-phase-plan.md): **Goal → Tasks → Done when**, and the module
follows the standard pattern **schema → API (with RBAC) → frontend → notifications →
seed/demo → verify live**.

**Goal:** Close the coursework loop on top of the existing `Course` module. Faculty
create assignments with a due date and point value; enrolled students submit text and/or
a file; faculty grade with feedback; students see their grade. This is the biggest jump in
real usefulness — it turns CampusHub from "clubs + attendance" into an actual academic tool.

**What it reuses (no new infrastructure):**
- The `Course` model + `canManageCourse` / enrollment checks (owner faculty or admin; enrolled student).
- The **one-doc-per-pair + unique compound index** pattern from `Registration` / `AttendanceRecord` — here `Submission` is unique per `{assignmentId, studentId}`.
- **Cloudinary** via a generalized `uploadFile()` (PDF/doc/zip, not just images).
- **Phase 6 notifications** — fan out on assignment-created and on graded (extends the `Notification.type` enum).
- **Recharts** (already bundled) for the gradebook distribution, mirroring the attendance analytics approach.

---

## Data model

### `Assignment` (`server/src/models/Assignment.js`)
| Field | Type | Notes |
|-------|------|-------|
| `courseId` | ObjectId → Course | required, indexed |
| `title` | String | required, trimmed |
| `description` | String | default `''` |
| `dueAt` | Date | required |
| `points` | Number | default `100`, min `0` (max score) |
| `attachmentUrl` | String | default `''` — optional single reference file from faculty |
| `collegeId` | String | default `env.defaultCollegeId`, indexed |
| `createdBy` | ObjectId → User | required |
| timestamps | | |

Index: `{ courseId: 1, dueAt: 1 }` (list a course's assignments by due date).

### `Submission` (`server/src/models/Submission.js`)
| Field | Type | Notes |
|-------|------|-------|
| `assignmentId` | ObjectId → Assignment | required, indexed |
| `courseId` | ObjectId → Course | **denormalized** so the gradebook aggregates without a join |
| `studentId` | ObjectId → User | required, indexed |
| `text` | String | default `''` |
| `fileUrl` | String | default `''` |
| `late` | Boolean | set at submit time (`now > assignment.dueAt`); preserved after grading |
| `status` | String enum `['submitted','graded']` | lifecycle; lateness lives in `late`, not here |
| `grade` | Number | default `null` (0…`points`) |
| `feedback` | String | default `''` |
| `submittedAt` | Date | |
| `gradedBy` | ObjectId → User | |
| `gradedAt` | Date | |
| `collegeId` | String | |
| timestamps | | |

Unique index: `{ assignmentId: 1, studentId: 1 }` — one submission per student per assignment (re-submitting updates the same doc, exactly like attendance marks).

> **Design note:** `late` is a boolean set once at submission, *not* a status value, so a
> late submission stays flagged late after it's graded (status → `graded`). This mirrors
> the attendance module keeping "attended = present||late" as derived logic rather than
> overloading one field.

---

## API

All routes require `protect`. Per-course permission is checked in-controller against
`Course.facultyId` / admin (manage) and `Course.studentIds` (enrolled), matching
`courseController` / `attendanceController`.

**Nested under courses** (`server/src/routes/course.routes.js`):
- `GET  /api/courses/:id/assignments` — list (manage or enrolled). Students see each assignment annotated with their own submission summary; faculty see submission counts (submitted / graded / enrolled).
- `POST /api/courses/:id/assignments` — create (owner faculty/admin). Optional `attachment` data-URI. Fans out an `assignment` notification to enrolled students.
- `GET  /api/courses/:id/gradebook` — owner/admin. Aggregation: per-student grades across all assignments + per-student average + per-assignment average.

**Flat assignment routes** (`server/src/routes/assignment.routes.js`, mounted `/api/assignments`):
- `GET    /api/assignments/:id` — detail (manage or enrolled). Student gets their own submission embedded.
- `PATCH  /api/assignments/:id` — edit title/description/dueAt/points/attachment (owner/admin).
- `DELETE /api/assignments/:id` — delete + cascade its submissions (owner/admin).
- `GET    /api/assignments/:id/submissions` — roster of enrolled students each with their submission (or null) (owner/admin).
- `POST   /api/assignments/:id/submissions` — submit/resubmit (enrolled student). Upsert one per `{assignmentId, studentId}`; sets `late`; blocked once `graded` (409).

**Flat submission route** (`server/src/routes/submission.routes.js`, mounted `/api/submissions`):
- `PATCH /api/submissions/:id/grade` — grade + feedback (owner/admin of the assignment's course). Validates `0 ≤ grade ≤ points`, sets status `graded`, fans out a `grade` notification to the student.

**Supporting changes:**
- `server/src/utils/uploadImage.js` — add `uploadFile(source, folder)` (`resource_type: 'auto'`) so non-image files upload; keep `uploadImage` for images.
- `server/src/models/Notification.js` — extend `type` enum to `['announcement','assignment','grade']`.
- `server/src/routes/index.js` — mount `/assignments` and `/submissions`.

---

## Frontend

- `client/src/services/assignments.js` — thin axios wrappers for every endpoint above.
- `client/src/utils/assignments.js` — helpers: `submissionChip(status, late)`, `dueLabel(dueAt)`, `isOverdue(dueAt)`, `fileToDataUrl(file)`.
- `client/src/pages/CourseDetail.jsx` — new **Assignments** section (list + faculty "new assignment" form), mirroring the existing Sessions section; each row links to the assignment.
- `client/src/pages/AssignmentDetail.jsx` — route `/assignments/:id`:
  - *Student:* assignment info + due/points, their current submission (or a submit form: text + optional file), and — once graded — their grade + feedback.
  - *Faculty:* assignment info + a submissions roster with inline grade + feedback fields (save per student).
- `client/src/pages/Gradebook.jsx` — route `/courses/:id/gradebook` (faculty): a table of students × assignments with grades, per-student average, and a small Recharts distribution.
- `client/src/App.jsx` — register the two new routes.
- CSS in `index.css` for the assignment list rows, submission cards, and grading roster (reuse existing `.card`, `.list`, `.chip`, `.field`, `.seg` tokens where possible).

---

## Notifications (Phase 6 integration)

- **Assignment created** → notify every enrolled student: *"New assignment: {title}"*, link `/assignments/{id}`.
- **Submission graded** → notify that student: *"Your submission for {title} was graded"*, link `/assignments/{id}`.

Uses `utils/notify.js#notifyUsers` (already persists + pushes live via the per-user socket rooms).

---

## Seed / demo data (`server/src/seed.js`)

Add to the seeded **CS-301** course:
- One assignment **"Binary Tree Traversals"** (due in the past, points 100).
- Submissions: Sam graded (e.g. 92, on time), Nina submitted-not-graded, Omar late+submitted, Priya no submission — so the roster, late flag, graded/ungraded states, and gradebook are all non-empty on first login.

---

## Tasks

- [x] `Assignment` + `Submission` models (+ unique `{assignmentId, studentId}` index)
- [x] `uploadFile()` in `uploadImage.js` (`resource_type: 'auto'`); extended `Notification.type` enum → `announcement`/`assignment`/`grade`
- [x] `assignmentController.js` — list/create (nested), get/update/delete, list/submit submissions, grade, gradebook
- [x] Grade endpoint folded into `assignmentController` (`gradeSubmission`), exposed via `submission.routes.js`
- [x] Routes: nested in `course.routes.js`; new `assignment.routes.js` + `submission.routes.js`; mounted in `routes/index.js`
- [x] Notifications on create (→ enrolled students) + grade (→ that student)
- [x] `services/assignments.js` + `utils/assignments.js`
- [x] Assignments section on `CourseDetail.jsx` (+ Gradebook link in manage actions)
- [x] `AssignmentDetail.jsx` (student submit + faculty grading roster) and route
- [x] `Gradebook.jsx` + route
- [x] Seed demo assignment + 3 submissions (graded / on-time / late; one student none)
- [x] Lint clean; verified live

### Follow-up enhancement (2026-08-25) — assignment authoring
- [x] `Assignment.linkUrl` field (Google Form / external link); serialized + accepted on create/update (clearable on edit)
- [x] Dedicated `AssignmentForm.jsx` (create at `/courses/:courseId/assignments/new`, edit at `/assignments/:id/edit`) with title, description, deadline (datetime-local), points, Google Form/link URL, and **PDF upload** (via `uploadFile`); replaces the old inline quick-create on `CourseDetail`
- [x] Edit + Delete actions on `AssignmentDetail` (faculty); detail shows the PDF and form-link buttons
- [x] Verified live: created an assignment with description + form link, edited its title, deleted it (roster cascade), and uploaded a real PDF → Cloudinary `.pdf` URL

---

## Done when

A faculty member creates an assignment with a due date; an enrolled student submits a file
before the deadline and sees it marked submitted; another student submits after the deadline
and is auto-flagged **late**; the faculty member grades both with feedback from the
submissions roster; each student immediately sees their grade + feedback and receives a
notification; the gradebook shows the grades from a real aggregation. All ownership/enrollment
rules are enforced at the API (a non-enrolled user gets 403; a student cannot grade).

✅ **Verified live against Atlas.** Faculty saw the assignment with submission stats (3 submitted /
1 graded / 4 enrolled) and the grading roster; a student with no submission submitted **after the
due date and was auto-flagged `late: true`**; faculty graded from the roster → the student received a
real-time **`grade` notification** (`"…graded: 70/100"`, deep-linked); resubmitting a graded
submission returned **409**, an out-of-range grade **400**, a student grading **403**, and a
non-enrolled user opening the assignment **403**; the gradebook aggregated Sam 92 / Priya 70 with the
rest ungraded. UI verified: faculty inline grading flipped a row **Submitted → Graded** live (header
"1 graded" → "2 graded"); the student page showed the **92/100** grade box + feedback + the graded
lock. Lint clean on both packages.
