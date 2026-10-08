// PROVISIONAL MOCK — Flow D (assessment, grading and certificates), development/test only.
//
// Mock-only assumptions:
// - Instructor grading is owner-only; Admin is deliberately excluded from the grading queue.
// - Certificate download is represented by a text/plain JSON resource rather than a file response.

import type { AttemptAnswer, AttemptRecord, ItemRecord, QuestionGrade, QuizQuestionRecord } from './db.ts';
import { iso, nextId } from './db.ts';
import {
  bestGradedAttempt, courseItems, evaluateCompletion, findEnrollment, getProgress, isPublished, toEnrollment,
  upsertProgress,
} from './domain.ts';
import {
  ApiError, created, notFound, ok, paginate, queryProblems, readObject, rejectUnknownFields, requireEligible,
  requireRole, requireUser, validationFailed,
} from './http.ts';
import type { FieldError, RequestContext, Route } from './http.ts';
import { findItem, requireLearningAccess, resumeItemId } from './flow-c-learning.ts';

function quizFound(context: RequestContext, itemId: string) {
  const found = findItem(context.db, itemId);
  if (!found || !isPublished(found.course) || found.item.type !== 'quiz' || !found.item.quiz) throw notFound();
  const access = requireLearningAccess(context, found.course);
  return { ...found, access, quiz: found.item.quiz };
}

function publicQuestion(question: QuizQuestionRecord) {
  return {
    id: question.id, type: question.type, prompt: question.prompt, points: question.points,
    options: question.options?.map((option) => ({ id: option.id, text: option.text })) ?? [],
  };
}

function publicAnswer(answer: AttemptAnswer): AttemptAnswer {
  return {
    ...(answer.option_ids ? { option_ids: [...answer.option_ids] } : {}),
    ...(answer.text !== undefined ? { text: answer.text } : {}),
    ...(answer.image_url !== undefined ? { image_url: answer.image_url } : {}),
  };
}

function attemptView(attempt: AttemptRecord) {
  const graded = attempt.status === 'graded';
  const earned = graded ? attempt.earned : null;
  return {
    id: attempt.id, item_id: attempt.item_id, course_id: attempt.course_id, number: attempt.number,
    status: attempt.status, started_at: attempt.started_at, submitted_at: attempt.submitted_at,
    graded_at: attempt.graded_at, questions: attempt.snapshot.map(publicQuestion),
    answers: Object.fromEntries(Object.entries(attempt.answers).map(([id, answer]) => [id, publicAnswer(answer)])),
    max: attempt.max, earned, percent: earned === null ? null : earned / attempt.max * 100,
    passed: graded ? attempt.passed : null,
    question_results: graded ? attempt.snapshot.map((question) => ({
      question_id: question.id,
      score: attempt.grades[question.id]?.score ?? 0,
      max: question.points,
      comment: attempt.grades[question.id]?.comment ?? null,
    })) : null,
  };
}

function answerProblems(question: QuizQuestionRecord, value: unknown, field: string): FieldError[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [{ field, code: 'object_required' }];
  const answer = value as Record<string, unknown>;
  const problems: FieldError[] = [];
  rejectUnknownFields(answer, ['option_ids', 'text', 'image_url']);
  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    const options = answer.option_ids;
    if (!Array.isArray(options) || !options.every((option) => typeof option === 'string')) {
      problems.push({ field: `${field}.option_ids`, code: 'required' });
    } else {
      const valid = new Set((question.options ?? []).map((option) => option.id));
      if (options.some((option) => !valid.has(option))) problems.push({ field: `${field}.option_ids`, code: 'invalid_option' });
      if (question.type === 'single_choice' && options.length !== 1) problems.push({ field: `${field}.option_ids`, code: 'exactly_one_required' });
    }
  } else if (question.type === 'essay') {
    if (typeof answer.text !== 'string' || answer.text.trim() === '') problems.push({ field: `${field}.text`, code: 'required' });
  } else if (typeof answer.image_url !== 'string' || answer.image_url.trim() === '') {
    problems.push({ field: `${field}.image_url`, code: 'required' });
  }
  return problems;
}

function answerRecord(value: Record<string, unknown>): AttemptAnswer {
  return {
    ...(Array.isArray(value.option_ids) ? { option_ids: [...value.option_ids] as string[] } : {}),
    ...(typeof value.text === 'string' ? { text: value.text } : {}),
    ...(typeof value.image_url === 'string' ? { image_url: value.image_url } : {}),
  };
}

function gradeChoice(question: QuizQuestionRecord, answer: AttemptAnswer): number {
  const expected = new Set(question.correct_option_ids ?? []);
  const selected = new Set(answer.option_ids ?? []);
  if (expected.size !== selected.size || [...expected].some((option) => !selected.has(option))) return 0;
  return question.points;
}

function finalizeAttempt(context: RequestContext, attempt: AttemptRecord): void {
  const earned = attempt.snapshot.reduce((sum, question) => sum + (attempt.grades[question.id]?.score ?? 0), 0);
  attempt.earned = earned;
  attempt.passed = earned * 100 > attempt.max * 70;
  attempt.status = 'graded';
  attempt.graded_at = iso(context.clock.now());
  if (!attempt.passed) return;
  const progress = upsertProgress(context.db, attempt.enrollment_id, attempt.item_id);
  if (!progress.completed_at) progress.completed_at = iso(context.clock.now());
  const enrollment = context.db.enrollments.get(attempt.enrollment_id);
  if (enrollment) evaluateCompletion(context.db, context.clock, enrollment);
}

function ownedAttempt(context: RequestContext, id: string): AttemptRecord {
  const attempt = context.db.attempts.get(id);
  const user = requireUser(context);
  if (!attempt || attempt.user_id !== user.id) throw notFound();
  return attempt;
}

function certView(certificate: { id: string; code: string; course_id: string; course_title: string; learner_name: string; issued_at: string; enrollment_id: string }) {
  return {
    id: certificate.id, code: certificate.code, course_id: certificate.course_id, course_title: certificate.course_title,
    learner_name: certificate.learner_name, issued_at: certificate.issued_at, enrollment_id: certificate.enrollment_id,
  };
}

export const assessmentRoutes: Route[] = [
  {
    method: 'POST', path: 'learn/items/:id/attempts',
    handler: (context) => {
      if (context.body !== undefined) rejectUnknownFields(readObject(context), []);
      const found = quizFound(context, context.params.id);
      const existing = [...context.db.attempts.values()].find((attempt) =>
        attempt.enrollment_id === found.access.enrollment.id && attempt.item_id === found.item.id && attempt.status === 'in_progress');
      if (existing) return ok(attemptView(existing));
      const previous = [...context.db.attempts.values()]
        .filter((attempt) => attempt.enrollment_id === found.access.enrollment.id && attempt.item_id === found.item.id)
        .reduce((max, attempt) => Math.max(max, attempt.number), 0);
      const snapshot = structuredClone(found.quiz.questions);
      const attempt: AttemptRecord = {
        id: nextId(context.db, 'att'), enrollment_id: found.access.enrollment.id, user_id: found.access.user.id,
        course_id: found.course.id, item_id: found.item.id, number: previous + 1, status: 'in_progress',
        snapshot, answers: {}, grades: {}, started_at: iso(context.clock.now()), submitted_at: null, graded_at: null,
        earned: null, max: snapshot.reduce((sum, question) => sum + question.points, 0), passed: null,
      };
      context.db.attempts.set(attempt.id, attempt);
      return created(attemptView(attempt));
    },
  },
  {
    method: 'PUT', path: 'learn/attempts/:id/answers',
    handler: (context) => {
      const attempt = ownedAttempt(context, context.params.id);
      if (attempt.status !== 'in_progress') throw new ApiError(409, 'invalid_state', 'แก้คำตอบไม่ได้ในสถานะนี้');
      const body = readObject(context);
      rejectUnknownFields(body, ['answers']);
      const answers = body.answers;
      if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) throw validationFailed([{ field: 'answers', code: 'object_required' }]);
      const problems: FieldError[] = [];
      for (const [questionId, value] of Object.entries(answers as Record<string, unknown>)) {
        const question = attempt.snapshot.find((candidate) => candidate.id === questionId);
        if (!question) { problems.push({ field: `answers.${questionId}`, code: 'unknown_question' }); continue; }
        try { problems.push(...answerProblems(question, value, `answers.${questionId}`)); } catch { problems.push({ field: `answers.${questionId}`, code: 'invalid' }); }
      }
      if (problems.length) throw validationFailed(problems);
      for (const [questionId, value] of Object.entries(answers as Record<string, unknown>)) {
        attempt.answers[questionId] = answerRecord(value as Record<string, unknown>);
      }
      return ok(attemptView(attempt));
    },
  },
  {
    method: 'POST', path: 'learn/attempts/:id/submit',
    handler: (context) => {
      if (context.body !== undefined) rejectUnknownFields(readObject(context), []);
      const attempt = ownedAttempt(context, context.params.id);
      if (attempt.status !== 'in_progress') return ok(attemptView(attempt));
      const missing = attempt.snapshot
        .filter((question) => !attempt.answers[question.id])
        .map((question) => ({ field: `answers.${question.id}`, code: 'required' }));
      if (missing.length) throw validationFailed(missing);
      attempt.submitted_at = iso(context.clock.now());
      const manual = attempt.snapshot.some((question) => question.type === 'essay' || question.type === 'image');
      for (const question of attempt.snapshot) {
        if (question.type === 'single_choice' || question.type === 'multiple_choice') {
          attempt.grades[question.id] = { score: gradeChoice(question, attempt.answers[question.id]), comment: null, graded_by: null, graded_at: iso(context.clock.now()) };
        }
      }
      if (manual) attempt.status = 'pending_review';
      else finalizeAttempt(context, attempt);
      return ok(attemptView(attempt));
    },
  },
  {
    method: 'GET', path: 'learn/attempts/:id',
    handler: (context) => ok(attemptView(ownedAttempt(context, context.params.id))),
  },
  {
    method: 'GET', path: 'learn/items/:id/results',
    handler: (context) => {
      const found = quizFound(context, context.params.id);
      const attempts = [...context.db.attempts.values()]
        .filter((attempt) => attempt.enrollment_id === found.access.enrollment.id && attempt.item_id === found.item.id)
        .sort((a, b) => a.number - b.number);
      const best = bestGradedAttempt(context.db, found.access.enrollment.id, found.item.id);
      return ok({
        attempts: attempts.map((attempt) => ({
          attempt_id: attempt.id, number: attempt.number, status: attempt.status, submitted_at: attempt.submitted_at,
          graded_at: attempt.graded_at, earned: attempt.earned, max: attempt.max,
          percent: attempt.earned === null ? null : attempt.earned / attempt.max * 100, passed: attempt.passed,
        })),
        best: best ? { attempt_id: best.id, earned: best.earned, max: best.max, percent: (best.earned ?? 0) / best.max * 100, passed: best.passed } : null,
        completed: Boolean(getProgress(context.db, found.access.enrollment.id, found.item.id)?.completed_at),
      });
    },
  },
  {
    method: 'GET', path: 'instructor/grading-queue',
    handler: (context) => {
      const instructor = requireRole(context, 'instructor');
      if (instructor.roles.includes('admin')) throw new ApiError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const rows = [...context.db.attempts.values()].filter((attempt) => {
        const course = context.db.courses.get(attempt.course_id);
        return attempt.status === 'pending_review' && course?.instructor_id === instructor.id;
      }).map((attempt) => {
        const learner = context.db.users.get(attempt.user_id);
        return {
          attempt_id: attempt.id, course_id: attempt.course_id, item_id: attempt.item_id,
          learner_display_name: learner?.display_name ?? '', submitted_at: attempt.submitted_at,
          questions_to_grade: attempt.snapshot.filter((question) => (question.type === 'essay' || question.type === 'image') && !attempt.grades[question.id]).map((question) => ({
            question_id: question.id, type: question.type, prompt: question.prompt, max: question.points,
            answer: publicAnswer(attempt.answers[question.id]),
          })),
        };
      });
      return ok(paginate(rows, context.query, context.config, problems));
    },
  },
  {
    method: 'PUT', path: 'instructor/attempts/:id/questions/:question_id/grade',
    handler: (context) => {
      const user = requireUser(context);
      if (user.roles.includes('admin')) throw new ApiError(403, 'forbidden', 'Admin ไม่มีสิทธิ์ตรวจคะแนน');
      const attempt = context.db.attempts.get(context.params.id);
      if (!attempt) throw notFound();
      const course = context.db.courses.get(attempt.course_id);
      if (!course || course.instructor_id !== user.id) throw user.roles.includes('instructor') ? notFound() : new ApiError(403, 'forbidden', 'ไม่มีสิทธิ์ตรวจคะแนน');
      if (attempt.status !== 'pending_review') throw new ApiError(409, 'invalid_state', 'Attempt นี้ไม่อยู่ระหว่างรอตรวจ');
      const question = attempt.snapshot.find((candidate) => candidate.id === context.params.question_id);
      if (!question || (question.type !== 'essay' && question.type !== 'image')) throw new ApiError(409, 'invalid_state', 'ข้อนี้ไม่ต้องตรวจเอง');
      const body = readObject(context);
      rejectUnknownFields(body, ['score', 'comment']);
      const problems: FieldError[] = [];
      if (typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0 || body.score > question.points || !Number.isInteger(body.score * 2)) problems.push({ field: 'score', code: 'invalid' });
      if (!('comment' in body)) problems.push({ field: 'comment', code: 'required' });
      else if (body.comment !== null && typeof body.comment !== 'string') problems.push({ field: 'comment', code: 'invalid' });
      if (problems.length) throw validationFailed(problems);
      attempt.grades[question.id] = { score: body.score as number, comment: body.comment === null || body.comment === undefined ? null : body.comment as string, graded_by: user.id, graded_at: iso(context.clock.now()) };
      const complete = attempt.snapshot.filter((candidate) => candidate.type === 'essay' || candidate.type === 'image').every((candidate) => Boolean(attempt.grades[candidate.id]));
      if (complete) finalizeAttempt(context, attempt);
      return ok(attemptView(attempt));
    },
  },
  {
    method: 'GET', path: 'me/certificates',
    handler: (context) => {
      const user = requireUser(context);
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const certificates = [...context.db.certificates.values()].filter((certificate) => certificate.user_id === user.id).sort((a, b) => b.issued_at.localeCompare(a.issued_at));
      return ok(paginate(certificates.map(certView), context.query, context.config, problems));
    },
  },
  {
    method: 'GET', path: 'me/certificates/:id',
    handler: (context) => {
      const user = requireUser(context);
      const certificate = context.db.certificates.get(context.params.id);
      if (!certificate || certificate.user_id !== user.id) throw notFound();
      return ok(certView(certificate));
    },
  },
  {
    method: 'GET', path: 'me/certificates/:id/download',
    handler: (context) => {
      const user = requireUser(context);
      const certificate = context.db.certificates.get(context.params.id);
      if (!certificate || certificate.user_id !== user.id) throw notFound();
      return ok({
        filename: `${certificate.code}.txt`, content_type: 'text/plain',
        content: `ใบรับรอง ${certificate.code}\nชื่อผู้เรียน: ${certificate.learner_name}\nคอร์ส: ${certificate.course_title}\nวันที่ออก: ${certificate.issued_at}`,
      });
    },
  },
];
