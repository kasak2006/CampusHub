import mongoose from 'mongoose';

import env from './config/env.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Club from './models/Club.js';
import ClubJoinRequest from './models/ClubJoinRequest.js';
import Event from './models/Event.js';
import Registration from './models/Registration.js';
import Course from './models/Course.js';
import AttendanceSession from './models/AttendanceSession.js';
import AttendanceRecord from './models/AttendanceRecord.js';
import Announcement from './models/Announcement.js';
import Assignment from './models/Assignment.js';
import Submission from './models/Submission.js';

/**
 * Seed known non-student accounts so the Phase 1 "done when" check is testable
 * immediately (a faculty account must land on a different dashboard than a
 * student). Idempotent — re-running upserts the same accounts rather than
 * duplicating them. Passwords are printed to the console for local testing.
 *
 *   npm run seed   (from server/)
 */
const SEED_USERS = [
  {
    name: 'Prof. Ada Faculty',
    email: 'faculty@campushub.test',
    password: 'faculty123',
    role: 'faculty',
    department: 'Computer Science',
  },
  {
    name: 'Alan Admin',
    email: 'admin@campushub.test',
    password: 'admin123',
    role: 'admin',
  },
  {
    name: 'Sam Student',
    email: 'student@campushub.test',
    password: 'student123',
    role: 'student',
    rollNumber: 'CS-2024-001',
    department: 'Computer Science',
  },
  // Phase 2: a club_lead so the lead dashboard is testable out of the box. The
  // role is set explicitly here; normally it's granted automatically on club
  // creation (see clubController.syncLeadRole).
  {
    name: 'Lena Lead',
    email: 'clublead@campushub.test',
    password: 'clublead123',
    role: 'club_lead',
    rollNumber: 'CS-2023-042',
    department: 'Computer Science',
  },
  // Phase 4: a few extra students so a course roster has enough people for the
  // attendance analytics (per-student %, below-threshold flag) to be meaningful.
  {
    name: 'Nina Novak',
    email: 'nina@campushub.test',
    password: 'student123',
    role: 'student',
    rollNumber: 'CS-2024-002',
    department: 'Computer Science',
  },
  {
    name: 'Omar Ortiz',
    email: 'omar@campushub.test',
    password: 'student123',
    role: 'student',
    rollNumber: 'CS-2024-003',
    department: 'Computer Science',
  },
  {
    name: 'Priya Patel',
    email: 'priya@campushub.test',
    password: 'student123',
    role: 'student',
    rollNumber: 'CS-2024-004',
    department: 'Computer Science',
  },
];

async function seed() {
  await connectDB();

  const usersByEmail = {};
  for (const data of SEED_USERS) {
    const email = data.email.toLowerCase().trim();
    // Delete-then-create so the pre('save') hook re-hashes the password and the
    // seed stays idempotent even if the schema/password changes.
    await User.deleteOne({ email });
    const user = await User.create({ ...data, email });
    usersByEmail[email] = user;
    console.log(`[seed] upserted ${data.role.padEnd(9)} ${email} / ${data.password}`);
  }

  // Phase 2: a demo club led by Lena, with Sam (student) having a pending join
  // request so the lead's "pending requests" list isn't empty on first login.
  const lead = usersByEmail['clublead@campushub.test'];
  const student = usersByEmail['student@campushub.test'];
  const CLUB_NAME = 'Coding Club';

  await Club.deleteOne({ collegeId: env.defaultCollegeId, name: CLUB_NAME });
  const club = await Club.create({
    name: CLUB_NAME,
    description: 'Weekly hack nights, competitive programming, and project showcases.',
    category: 'Technology',
    createdBy: lead._id,
    leadIds: [lead._id],
    memberIds: [lead._id],
  });
  console.log(`[seed] created club "${club.name}" led by ${lead.email}`);

  await ClubJoinRequest.deleteMany({ clubId: club._id });
  await ClubJoinRequest.create({
    clubId: club._id,
    userId: student._id,
    message: 'I love competitive programming - would love to join!',
    collegeId: env.defaultCollegeId,
  });
  console.log(`[seed] created pending join request from ${student.email} → ${club.name}`);

  // Phase 3: a demo event with a small capacity so the live count + waitlist
  // flow is easy to exercise (register from two tabs, fill the 2 seats, watch a
  // 3rd registration land on the waitlist).
  // Clear ALL events/registrations in the college so reseeds stay clean — each
  // reseed makes a fresh club id, so deleting by clubId would orphan old events.
  await Event.deleteMany({ collegeId: env.defaultCollegeId });
  await Registration.deleteMany({ collegeId: env.defaultCollegeId });
  const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // one week out
  const event = await Event.create({
    clubId: club._id,
    title: 'Hackathon Kickoff',
    description: 'Kick off the semester hackathon - teams, themes, and free pizza.',
    location: 'Auditorium B',
    startAt,
    capacity: 2,
    collegeId: env.defaultCollegeId,
    createdBy: lead._id,
  });
  console.log(`[seed] created event "${event.title}" (capacity ${event.capacity}) for ${club.name}`);

  // Phase 4: a demo course owned by the faculty account with four enrolled
  // students and four past sessions of marks, arranged so the analytics are
  // interesting out of the box — Priya lands below the 75% threshold.
  const faculty = usersByEmail['faculty@campushub.test'];
  const roster = ['student', 'nina', 'omar', 'priya'].map((k) =>
    k === 'student' ? student : usersByEmail[`${k}@campushub.test`]
  );

  await AttendanceRecord.deleteMany({ collegeId: env.defaultCollegeId });
  await AttendanceSession.deleteMany({ collegeId: env.defaultCollegeId });
  await Course.deleteMany({ collegeId: env.defaultCollegeId });

  const course = await Course.create({
    name: 'Data Structures',
    code: 'CS-301',
    description: 'Arrays, trees, graphs, and the algorithms that walk them.',
    facultyId: faculty._id,
    studentIds: roster.map((u) => u._id),
    collegeId: env.defaultCollegeId,
    createdBy: faculty._id,
  });
  console.log(`[seed] created course "${course.code} ${course.name}" with ${roster.length} students`);

  // Four sessions over the last four weeks (oldest first).
  const P = 'present';
  const L = 'late';
  const A = 'absent';
  // rows: one status list per student, columns are the four sessions.
  const marks = {
    student: [P, P, P, P], // Sam   → 100%
    nina: [P, P, A, P], //   Nina  → 75%
    omar: [P, L, A, P], //   Omar  → 75% (late counts as attended)
    priya: [A, A, P, A], //  Priya → 25% (below threshold)
  };
  const rosterKeys = ['student', 'nina', 'omar', 'priya'];

  for (let i = 0; i < 4; i += 1) {
    const d = new Date(Date.now() - (4 - i) * 7 * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().slice(0, 10);
    const session = await AttendanceSession.create({
      courseId: course._id,
      date: new Date(`${dateKey}T00:00:00.000Z`),
      dateKey,
      title: `Lecture ${i + 1}`,
      collegeId: env.defaultCollegeId,
      createdBy: faculty._id,
    });
    await AttendanceRecord.insertMany(
      rosterKeys.map((key, r) => ({
        sessionId: session._id,
        courseId: course._id,
        studentId: roster[r]._id,
        status: marks[key][i],
        collegeId: env.defaultCollegeId,
        markedBy: faculty._id,
      }))
    );
  }
  console.log('[seed] created 4 attendance sessions with marks (Priya is below 75%)');

  // Phase 7: one assignment on CS-301 with a spread of submission states so the
  // grading roster, late flag, graded/ungraded states, and gradebook are all
  // non-empty on first login. roster = [Sam, Nina, Omar, Priya].
  await Submission.deleteMany({ collegeId: env.defaultCollegeId });
  await Assignment.deleteMany({ collegeId: env.defaultCollegeId });
  const dueAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // due 3 days ago
  const assignment = await Assignment.create({
    courseId: course._id,
    title: 'Binary Tree Traversals',
    description: 'Implement in-order, pre-order, and post-order traversal and submit your code.',
    dueAt,
    points: 100,
    linkUrl: 'https://forms.gle/example-binary-tree-submission',
    collegeId: env.defaultCollegeId,
    createdBy: faculty._id,
  });
  const [sam, nina, omar] = roster; // priya intentionally left with no submission
  await Submission.create([
    {
      assignmentId: assignment._id,
      courseId: course._id,
      studentId: sam._id,
      text: 'Here is my recursive implementation of all three traversals.',
      late: false,
      status: 'graded',
      grade: 92,
      feedback: 'Clean recursion. Consider an iterative version for the bonus.',
      submittedAt: new Date(dueAt.getTime() - 24 * 60 * 60 * 1000), // a day early
      gradedBy: faculty._id,
      gradedAt: new Date(),
      collegeId: env.defaultCollegeId,
    },
    {
      assignmentId: assignment._id,
      courseId: course._id,
      studentId: nina._id,
      text: 'Submitting my solution - used a stack for the iterative in-order walk.',
      late: false,
      status: 'submitted',
      submittedAt: new Date(dueAt.getTime() - 2 * 60 * 60 * 1000), // just before due
      collegeId: env.defaultCollegeId,
    },
    {
      assignmentId: assignment._id,
      courseId: course._id,
      studentId: omar._id,
      text: 'Sorry this is a little late!',
      late: true,
      status: 'submitted',
      submittedAt: new Date(dueAt.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days late
      collegeId: env.defaultCollegeId,
    },
  ]);
  console.log('[seed] created assignment "Binary Tree Traversals" with 3 submissions (1 graded, 1 on-time, 1 late; Priya none)');

  // Phase 6: a few demo announcements across the three scopes so the feed and
  // the notification bell aren't empty on first login. (No live notifications
  // are fanned out here — the socket server isn't running during a seed; the
  // feed is populated directly.)
  await Announcement.deleteMany({ collegeId: env.defaultCollegeId });
  await Announcement.create([
    {
      scope: 'college',
      targetId: null,
      title: 'Welcome to the new semester!',
      body: 'Campus reopens Monday. Check your dashboard for clubs, events, and your course attendance.',
      pinned: true,
      authorId: faculty._id,
      collegeId: env.defaultCollegeId,
    },
    {
      scope: 'club',
      targetId: club._id,
      title: 'Hack night this Friday',
      body: 'Bring a laptop and an idea - pizza is on the club. See the Hackathon Kickoff event to register.',
      authorId: lead._id,
      collegeId: env.defaultCollegeId,
    },
    {
      scope: 'course',
      targetId: course._id,
      title: 'Lecture 5 moved to Lab 2',
      body: 'Next week we are in Lab 2 for a hands-on session on balanced trees. Same time.',
      authorId: faculty._id,
      collegeId: env.defaultCollegeId,
    },
  ]);
  console.log('[seed] created 3 demo announcements (college, club, course scopes)');

  console.log(`[seed] Done. Seeded ${SEED_USERS.length} accounts into "${env.defaultCollegeId}".`);
  await mongoose.connection.close();
}

seed().catch(async (err) => {
  console.error('[seed] Failed:', err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
