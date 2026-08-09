import mongoose from 'mongoose';

import env from './config/env.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Club from './models/Club.js';
import ClubJoinRequest from './models/ClubJoinRequest.js';
import Event from './models/Event.js';
import Registration from './models/Registration.js';

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
    message: 'I love competitive programming — would love to join!',
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
    description: 'Kick off the semester hackathon — teams, themes, and free pizza.',
    location: 'Auditorium B',
    startAt,
    capacity: 2,
    collegeId: env.defaultCollegeId,
    createdBy: lead._id,
  });
  console.log(`[seed] created event "${event.title}" (capacity ${event.capacity}) for ${club.name}`);

  console.log(`[seed] Done. Seeded ${SEED_USERS.length} accounts into "${env.defaultCollegeId}".`);
  await mongoose.connection.close();
}

seed().catch(async (err) => {
  console.error('[seed] Failed:', err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
