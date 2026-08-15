import { Router } from 'express';
import {
  listCourses,
  createCourse,
  getCourse,
  updateCourse,
  deleteCourse,
  enrollStudents,
  unenrollStudent,
  courseAnalytics,
} from '../controllers/courseController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

/**
 * Courses module routes (Phase 4), mounted at /api/courses.
 *
 * All routes require authentication. Creating a course is restricted to faculty
 * and admins (`authorize`); management of a specific course (edit/delete, roster,
 * analytics) is further restricted to that course's owning faculty or an admin,
 * enforced inside the controllers. Listing and detail are role-aware — students
 * see the courses they're enrolled in with their own attendance %.
 */
const router = Router();

router.use(protect);

router.route('/').get(listCourses).post(authorize('faculty', 'admin'), createCourse);
router.route('/:id').get(getCourse).patch(updateCourse).delete(deleteCourse);

router.post('/:id/students', enrollStudents);
router.delete('/:id/students/:studentId', unenrollStudent);

router.get('/:id/analytics', courseAnalytics);

export default router;
