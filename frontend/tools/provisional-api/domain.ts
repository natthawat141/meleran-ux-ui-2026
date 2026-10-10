// PROVISIONAL MOCK — development and tests only.
//
// Rules and public projections shared by several flow modules. Public shapes are built by copying an explicit
// allow-list of fields, never by spreading records, so a field added to a record cannot leak by accident.
// Projections mirror the DTO sketches in docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md; they are drafts.

import type {
  AttemptRecord, Clock, CertificateRecord, CompletionSnapshotItem, CourseRecord, Db, EnrollmentRecord, EnrollmentSource,
  ItemRecord, ProgressRecord, UserRecord,
} from './db.ts';
import { iso, nextId } from './db.ts';
import { isLearningEligible } from './http.ts';
import type { CurrentUser, CourseSummary, CourseDetail } from '../../packages/contracts/src/index.ts';

export const mockCurrency = 'THB';

export function toInstructorSummary(db: Db, instructorId: string) {
  const instructor = db.users.get(instructorId);
  return { id: instructorId, display_name: instructor?.display_name ?? 'ผู้สอน', avatar_url: instructor?.avatar_url ?? null };
}

export function toCourseSummary(db: Db, course: CourseRecord): CourseSummary {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    cover_url: course.cover_url,
    category: course.category,
    level: course.level,
    price: course.price ? { amount_minor: course.price.amount_minor, currency: course.price.currency } : null,
    instructor: toInstructorSummary(db, course.instructor_id),
    published_at: course.published_at as string,
  };
}

export function toCourseDetail(db: Db, course: CourseRecord): CourseDetail {
  return {
    ...toCourseSummary(db, course),
    description: course.description,
    outcomes: [...course.outcomes],
    outline: course.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      items: chapter.items.map((item) => ({ id: item.id, type: item.type, title: item.title })),
    })),
  };
}

export function toCurrentUser(user: UserRecord): CurrentUser {
  return {
    id: user.id,
    display_name: user.display_name,
    username: user.username,
    email: user.email,
    email_verified: user.email_verified,
    avatar_url: user.avatar_url,
    roles: [...user.roles],
    origin: user.origin,
    auth_methods: [...(user.password ? ['password' as const] : []), ...(user.google_subject ? ['google' as const] : [])],
    learning_eligible: isLearningEligible(user),
    profile: structuredClone(user.profile ?? {}),
  };
}

export function toEnrollment(enrollment: EnrollmentRecord) {
  return {
    id: enrollment.id,
    course_id: enrollment.course_id,
    source: enrollment.source,
    access: 'lifetime' as const,
    granted_at: enrollment.granted_at,
  };
}

export const isPublished = (course: CourseRecord): boolean => course.status === 'published' && course.published_at !== null;

export const courseItems = (course: CourseRecord): ItemRecord[] => course.chapters.flatMap((chapter) => chapter.items);

export function findEnrollment(db: Db, userId: string, courseId: string): EnrollmentRecord | undefined {
  for (const enrollment of db.enrollments.values()) {
    if (enrollment.user_id === userId && enrollment.course_id === courseId) return enrollment;
  }
  return undefined;
}

/** One Enrollment per (user, course): returns the existing one, otherwise creates it. */
export function grantEnrollment(db: Db, clock: Clock, userId: string, courseId: string, source: EnrollmentSource): { enrollment: EnrollmentRecord; created: boolean } {
  const existing = findEnrollment(db, userId, courseId);
  if (existing) return { enrollment: existing, created: false };
  const enrollment: EnrollmentRecord = {
    id: nextId(db, 'enr'), user_id: userId, course_id: courseId, source, granted_at: iso(clock.now()),
    completed_at: null, completion_snapshot: null,
  };
  db.enrollments.set(enrollment.id, enrollment);
  return { enrollment, created: true };
}

export const progressKey = (enrollmentId: string, itemId: string): string => `${enrollmentId}:${itemId}`;

export function getProgress(db: Db, enrollmentId: string, itemId: string): ProgressRecord | undefined {
  return db.progress.get(progressKey(enrollmentId, itemId));
}

export function upsertProgress(db: Db, enrollmentId: string, itemId: string): ProgressRecord {
  const key = progressKey(enrollmentId, itemId);
  let record = db.progress.get(key);
  if (!record) {
    record = { enrollment_id: enrollmentId, item_id: itemId, completed_at: null, resume: null };
    db.progress.set(key, record);
  }
  return record;
}

/**
 * Scope 2.5: Progress = completed items ÷ items in the course *now*. The ratio is never rounded up: the
 * numerator only counts items that still exist, so a half-finished course can never read as 100%.
 */
export function progressSummary(db: Db, enrollment: EnrollmentRecord, course: CourseRecord) {
  const items = courseItems(course);
  const completed = items.filter((item) => getProgress(db, enrollment.id, item.id)?.completed_at).length;
  return { completed_items: completed, total_items: items.length, completed_at: enrollment.completed_at };
}

/** Scope 2.7/5.7: complete at 100% once, keep the snapshot, issue exactly one certificate per Enrollment. */
export function evaluateCompletion(db: Db, clock: Clock, enrollment: EnrollmentRecord): CertificateRecord | null {
  const existing = certificateForEnrollment(db, enrollment.id);
  if (enrollment.completed_at) return existing ?? issueCertificate(db, clock, enrollment);
  const course = db.courses.get(enrollment.course_id);
  if (!course) return null;
  const items = courseItems(course);
  if (items.length === 0) return null;
  const snapshot: CompletionSnapshotItem[] = [];
  for (const item of items) {
    const progress = getProgress(db, enrollment.id, item.id);
    if (!progress?.completed_at) return null;
    const entry: CompletionSnapshotItem = { item_id: item.id, type: item.type, title: item.title, completed_at: progress.completed_at };
    if (item.type === 'quiz') {
      const best = bestGradedAttempt(db, enrollment.id, item.id);
      if (!best || !best.passed) return null;
      entry.attempt_id = best.id;
      entry.earned = best.earned ?? 0;
      entry.max = best.max;
    }
    snapshot.push(entry);
  }
  enrollment.completed_at = iso(clock.now());
  enrollment.completion_snapshot = snapshot;
  return issueCertificate(db, clock, enrollment);
}

export function certificateForEnrollment(db: Db, enrollmentId: string): CertificateRecord | undefined {
  for (const certificate of db.certificates.values()) if (certificate.enrollment_id === enrollmentId) return certificate;
  return undefined;
}

function issueCertificate(db: Db, clock: Clock, enrollment: EnrollmentRecord): CertificateRecord {
  const existing = certificateForEnrollment(db, enrollment.id);
  if (existing) return existing;
  const learner = db.users.get(enrollment.user_id);
  const course = db.courses.get(enrollment.course_id);
  const id = nextId(db, 'cert');
  const certificate: CertificateRecord = {
    id, code: `MLN-${id.slice(5)}`, enrollment_id: enrollment.id, user_id: enrollment.user_id, course_id: enrollment.course_id,
    learner_name: learner?.profile?.certificateName?.trim()
      || [learner?.profile?.firstName, learner?.profile?.lastName].map((part) => part?.trim()).filter(Boolean).join(' ')
      || learner?.display_name || '',
    course_title: course?.title ?? '', issued_at: iso(clock.now()),
  };
  db.certificates.set(id, certificate);
  return certificate;
}

/**
 * Scope 2.6: the highest *graded* attempt decides. Ties keep the earliest attempt. Attempts that are still
 * waiting for an Instructor never decide anything.
 */
export function bestGradedAttempt(db: Db, enrollmentId: string, itemId: string): AttemptRecord | undefined {
  let best: AttemptRecord | undefined;
  for (const attempt of db.attempts.values()) {
    if (attempt.enrollment_id !== enrollmentId || attempt.item_id !== itemId || attempt.status !== 'graded') continue;
    const score = attempt.earned ?? 0;
    if (!best || score / attempt.max > (best.earned ?? 0) / best.max) best = attempt;
  }
  return best;
}
