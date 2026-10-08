// PROVISIONAL MOCK — Flow E (course authoring and review), development/test only.
//
// Mock-only assumptions:
// - Authoring lists use the shared cursor pagination helper and sort by updated_at then id.
// - The authoring DTO includes `has_ai_transcript` for every video item; transcript text remains Flow G-only.
// - Nested chapters/items/questions/options are replaced atomically by PATCH.

import type {
  ChapterRecord, CourseRecord, Db, ItemRecord, ItemType, QuestionType, QuizQuestionRecord, ReviewRecord,
} from './db.ts';
import { iso, nextId } from './db.ts';
import {
  ApiError, created, notFound, ok, paginate, queryProblems, readObject, rejectUnknownFields, requireRole,
  validationFailed,
} from './http.ts';
import type { FieldError, RequestContext, Route } from './http.ts';
import { toInstructorSummary } from './domain.ts';

const metadataFields = ['title', 'subtitle', 'description', 'cover_url', 'category', 'level', 'price', 'outcomes'] as const;
const createFields = [...metadataFields, 'instructor_id'] as const;
const youtube = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;
const shortYoutube = /^https:\/\/youtu\.be\/[A-Za-z0-9_-]{11}(?:\?.*)?$/;

function courseOr404(db: Db, id: string): CourseRecord {
  const course = db.courses.get(id);
  if (!course) throw notFound();
  return course;
}

function canManage(context: RequestContext, course: CourseRecord): void {
  const user = requireRole(context, context.principal?.roles.includes('admin') ? 'admin' : 'instructor');
  if (!user.roles.includes('admin') && course.instructor_id !== user.id) throw notFound();
}

function requiredRevision(body: Record<string, unknown>): number {
  if (!Number.isInteger(body.expected_revision)) {
    throw validationFailed([{ field: 'expected_revision', code: 'required' }]);
  }
  return body.expected_revision as number;
}

function checkRevision(course: CourseRecord, expected: number): void {
  if (course.revision !== expected) {
    throw new ApiError(409, 'revision_conflict', 'ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดแล้วตรวจอีกครั้ง', {
      details: { current_revision: course.revision },
    });
  }
}

function latestReview(db: Db, courseId: string): ReviewRecord | undefined {
  return [...db.reviews.values()].filter((review) => review.course_id === courseId)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at) || b.id.localeCompare(a.id))[0];
}

function reviewView(review: ReviewRecord | undefined) {
  if (!review) return null;
  return {
    id: review.id, revision: review.revision, status: review.status, submitted_by: review.submitted_by,
    submitted_at: review.submitted_at, decided_by: review.decided_by, decided_at: review.decided_at, reason: review.reason,
  };
}

function questionView(question: QuizQuestionRecord, includeKeys: boolean) {
  return {
    id: question.id, type: question.type, prompt: question.prompt, points: question.points,
    ...(question.options ? { options: question.options.map((option) => ({ id: option.id, text: option.text })) } : {}),
    ...(includeKeys && question.correct_option_ids ? { correct_option_ids: [...question.correct_option_ids] } : {}),
  };
}

function itemView(item: ItemRecord, includeKeys: boolean, includeTranscriptFlag = true) {
  return {
    id: item.id, type: item.type, title: item.title,
    ...(item.video_url !== undefined ? { video_url: item.video_url } : {}),
    ...(item.body !== undefined ? { body: item.body } : {}),
    ...(item.quiz ? { quiz: { questions: item.quiz.questions.map((question) => questionView(question, includeKeys)) } } : {}),
    ...(item.type === 'video' && includeTranscriptFlag ? { has_ai_transcript: Boolean(item.ai_transcript) } : {}),
  };
}

function authoringView(db: Db, course: CourseRecord, includeKeys: boolean) {
  return {
    id: course.id, slug: course.slug, title: course.title, subtitle: course.subtitle, description: course.description,
    cover_url: course.cover_url, category: course.category, level: course.level,
    price: course.price ? { amount_minor: course.price.amount_minor, currency: course.price.currency } : null,
    outcomes: [...course.outcomes], instructor: toInstructorSummary(db, course.instructor_id),
    chapters: course.chapters.map((chapter) => ({
      id: chapter.id, title: chapter.title, items: chapter.items.map((item) => itemView(item, includeKeys)),
    })),
    status: course.status, revision: course.revision, published_at: course.published_at,
    latest_review: reviewView(latestReview(db, course.id)), ai_enabled: course.ai_enabled,
  };
}

function summary(db: Db, course: CourseRecord) {
  return {
    id: course.id, title: course.title, status: course.status, revision: course.revision,
    instructor: toInstructorSummary(db, course.instructor_id), updated_at: course.updated_at,
  };
}

function validateMetadata(body: Record<string, unknown>, requiredTitle: boolean): {
  values: Partial<CourseRecord>; problems: FieldError[];
} {
  const problems: FieldError[] = [];
  const values: Partial<CourseRecord> = {};
  if (requiredTitle && (typeof body.title !== 'string' || body.title.trim() === '')) problems.push({ field: 'title', code: 'required' });
  for (const field of ['title', 'subtitle', 'description', 'cover_url', 'category', 'level'] as const) {
    if (!(field in body)) continue;
    if (body[field] !== null && typeof body[field] !== 'string') problems.push({ field, code: 'invalid' });
    else (values as Record<string, unknown>)[field] = body[field] === null ? null : (body[field] as string).trim();
    if (field === 'title' && typeof body[field] === 'string' && body[field].trim() === '') problems.push({ field, code: 'required' });
  }
  if ('outcomes' in body) {
    if (!Array.isArray(body.outcomes) || body.outcomes.some((value) => typeof value !== 'string')) problems.push({ field: 'outcomes', code: 'invalid' });
    else values.outcomes = body.outcomes.map((value) => value.trim());
  }
  if ('price' in body) {
    const price = body.price;
    if (price !== null && (typeof price !== 'object' || Array.isArray(price))) problems.push({ field: 'price', code: 'invalid' });
    else if (price !== null) {
      const record = price as Record<string, unknown>;
      if (!Number.isInteger(record.amount_minor) || (record.amount_minor as number) < 0 || record.currency !== 'THB') problems.push({ field: 'price', code: 'invalid' });
      else values.price = { amount_minor: record.amount_minor as number, currency: 'THB' };
    } else values.price = null;
  }
  return { values, problems };
}

function replaceChapters(context: RequestContext, course: CourseRecord, raw: unknown): ChapterRecord[] {
  if (!Array.isArray(raw)) throw validationFailed([{ field: 'chapters', code: 'invalid' }]);
  const oldChapters = new Map(course.chapters.map((chapter) => [chapter.id, chapter]));
  const oldItems = new Map(course.chapters.flatMap((chapter) => chapter.items).map((item) => [item.id, item]));
  const oldQuestions = new Map(course.chapters.flatMap((chapter) => chapter.items).flatMap((item) => item.quiz?.questions ?? []).map((question) => [question.id, question]));
  const oldOptions = new Map(course.chapters.flatMap((chapter) => chapter.items).flatMap((item) => item.quiz?.questions ?? []).flatMap((question) => question.options ?? []).map((option) => [option.id, option]));
  const problems: FieldError[] = [];
  const chapters: ChapterRecord[] = [];
  const seen = new Set<string>();
  const issue = (field: string, code = 'invalid') => problems.push({ field, code });
  for (const [chapterIndex, rawChapter] of raw.entries()) {
    if (!rawChapter || typeof rawChapter !== 'object' || Array.isArray(rawChapter)) { issue(`chapters[${chapterIndex}]`); continue; }
    const chapterBody = rawChapter as Record<string, unknown>;
    const title = typeof chapterBody.title === 'string' ? chapterBody.title.trim() : '';
    if (!title) issue(`chapters[${chapterIndex}].title`, 'required');
    let chapterId: string;
    if (chapterBody.id !== undefined) {
      if (typeof chapterBody.id !== 'string' || !oldChapters.has(chapterBody.id)) throw validationFailed([{ field: `chapters[${chapterIndex}].id`, code: 'unknown_id' }]);
      chapterId = chapterBody.id;
    } else chapterId = nextId(context.db, 'chp');
    if (seen.has(chapterId)) issue(`chapters[${chapterIndex}].id`, 'duplicate');
    seen.add(chapterId);
    if (!Array.isArray(chapterBody.items)) { issue(`chapters[${chapterIndex}].items`); continue; }
    const items: ItemRecord[] = [];
    const itemSeen = new Set<string>();
    for (const [itemIndex, rawItem] of chapterBody.items.entries()) {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) { issue(`chapters[${chapterIndex}].items[${itemIndex}]`); continue; }
      const itemBody = rawItem as Record<string, unknown>;
      const type = itemBody.type;
      const itemTitle = typeof itemBody.title === 'string' ? itemBody.title.trim() : '';
      if (type !== 'video' && type !== 'article' && type !== 'quiz') issue(`chapters[${chapterIndex}].items[${itemIndex}].type`);
      if (!itemTitle) issue(`chapters[${chapterIndex}].items[${itemIndex}].title`, 'required');
      let itemId: string;
      if (itemBody.id !== undefined) {
        if (typeof itemBody.id !== 'string' || !oldItems.has(itemBody.id)) throw validationFailed([{ field: `chapters[${chapterIndex}].items[${itemIndex}].id`, code: 'unknown_id' }]);
        itemId = itemBody.id;
      } else itemId = nextId(context.db, 'itm');
      if (itemSeen.has(itemId)) issue(`chapters[${chapterIndex}].items[${itemIndex}].id`, 'duplicate');
      itemSeen.add(itemId);
      const item: ItemRecord = { id: itemId, type: type as ItemType, title: itemTitle };
      if (type === 'video') {
        const old = oldItems.get(itemId);
        const videoUrl = itemBody.video_url;
        const unchanged = old?.video_url !== undefined && videoUrl === old.video_url;
        if (typeof videoUrl !== 'string' || (!youtube.test(videoUrl) && !shortYoutube.test(videoUrl) && !unchanged)) issue(`chapters[${chapterIndex}].items[${itemIndex}].video_url`, 'invalid');
        else item.video_url = videoUrl;
        if (unchanged) item.ai_transcript = old?.ai_transcript;
      } else if (type === 'article') {
        if (typeof itemBody.body !== 'string') issue(`chapters[${chapterIndex}].items[${itemIndex}].body`, 'required');
        else item.body = itemBody.body;
      } else {
        const quiz = itemBody.quiz;
        if (!quiz || typeof quiz !== 'object' || Array.isArray(quiz) || !Array.isArray((quiz as Record<string, unknown>).questions)) {
          issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz`, 'required');
        } else {
          const questions: QuizQuestionRecord[] = [];
          for (const [questionIndex, rawQuestion] of ((quiz as Record<string, unknown>).questions as unknown[]).entries()) {
            if (!rawQuestion || typeof rawQuestion !== 'object' || Array.isArray(rawQuestion)) { issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}]`); continue; }
            const questionBody = rawQuestion as Record<string, unknown>;
            const qType = questionBody.type;
            const prompt = typeof questionBody.prompt === 'string' ? questionBody.prompt.trim() : '';
            const points = questionBody.points;
            if (!['single_choice', 'multiple_choice', 'essay', 'image'].includes(qType as string)) issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].type`);
            if (!prompt) issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].prompt`, 'required');
            if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0) issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].points`, 'invalid');
            let questionId: string;
            if (questionBody.id !== undefined) {
              if (typeof questionBody.id !== 'string' || !oldQuestions.has(questionBody.id)) throw validationFailed([{ field: `chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].id`, code: 'unknown_id' }]);
              questionId = questionBody.id;
            } else questionId = nextId(context.db, 'qst');
            const question: QuizQuestionRecord = { id: questionId, type: qType as QuestionType, prompt, points: points as number };
            if (qType === 'single_choice' || qType === 'multiple_choice') {
              if (!Array.isArray(questionBody.options) || questionBody.options.length < 2) issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].options`, 'too_few');
              else {
                question.options = [];
                const optionIds = new Set<string>();
                for (const [optionIndex, rawOption] of questionBody.options.entries()) {
                  if (!rawOption || typeof rawOption !== 'object' || Array.isArray(rawOption)) { issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].options[${optionIndex}]`); continue; }
                  const optionBody = rawOption as Record<string, unknown>;
                  let optionId: string;
                  if (optionBody.id !== undefined) {
                    if (typeof optionBody.id !== 'string' || !oldOptions.has(optionBody.id)) throw validationFailed([{ field: `chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].options[${optionIndex}].id`, code: 'unknown_id' }]);
                    optionId = optionBody.id;
                  } else optionId = nextId(context.db, 'opt');
                  if (optionIds.has(optionId) || typeof optionBody.text !== 'string' || optionBody.text.trim() === '') issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].options[${optionIndex}]`);
                  optionIds.add(optionId);
                  question.options.push({ id: optionId, text: typeof optionBody.text === 'string' ? optionBody.text.trim() : '' });
                }
                if (!Array.isArray(questionBody.correct_option_ids)) issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].correct_option_ids`, 'required');
                else {
                  const correct = questionBody.correct_option_ids.filter((id): id is string => typeof id === 'string');
                  if (correct.some((id) => !optionIds.has(id))) issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].correct_option_ids`, 'unknown_option');
                  if (qType === 'single_choice' && correct.length !== 1) issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].correct_option_ids`, 'exactly_one');
                  if (qType === 'multiple_choice' && correct.length < 1) issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}].correct_option_ids`, 'required');
                  question.correct_option_ids = correct;
                }
              }
            } else if ('options' in questionBody || 'correct_option_ids' in questionBody) {
              issue(`chapters[${chapterIndex}].items[${itemIndex}].quiz.questions[${questionIndex}]`, 'unsupported');
            }
            questions.push(question);
          }
          item.quiz = { questions };
        }
      }
      items.push(item);
    }
    chapters.push({ id: chapterId, title, items });
  }
  if (problems.length) throw validationFailed(problems);
  return chapters;
}

function applyChange(context: RequestContext, course: CourseRecord, body: Record<string, unknown>, isCreate = false): void {
  rejectUnknownFields(body, [...metadataFields, ...(isCreate ? ['instructor_id'] : []), ...(isCreate ? [] : ['expected_revision', 'chapters'])]);
  const forbiddenNested = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(forbiddenNested);
    const object = value as Record<string, unknown>;
    return Object.keys(object).some((key) => key === 'ai_enabled' || key === 'ai_transcript' || forbiddenNested(object[key]));
  };
  if (forbiddenNested(body)) throw validationFailed([{ field: 'ai_enabled', code: 'unsupported' }]);
  const { values, problems } = validateMetadata(body, isCreate);
  if (problems.length) throw validationFailed(problems);
  for (const [key, value] of Object.entries(values)) (course as unknown as Record<string, unknown>)[key] = value;
  if ('chapters' in body) course.chapters = replaceChapters(context, course, body.chapters);
}

function mutateStateAfterEdit(course: CourseRecord, review: ReviewRecord | undefined): void {
  if (course.status === 'approved') course.status = 'draft';
  else if (course.status === 'pending_review') {
    if (review?.status === 'pending') review.status = 'stale';
    course.status = 'draft';
  }
}

export const authoringRoutes: Route[] = [
  {
    method: 'POST', path: 'instructor/courses',
    handler: (context) => {
      const instructor = requireRole(context, 'instructor');
      const body = readObject(context);
      rejectUnknownFields(body, metadataFields);
      const course: CourseRecord = {
        id: nextId(context.db, 'crs'), slug: '', status: 'draft', title: '', subtitle: null, description: null, cover_url: null,
        category: '', level: '', price: null, instructor_id: instructor.id, published_at: null, outcomes: [], chapters: [],
        internal_review_notes: '', revision: 1, ai_enabled: false, created_by: instructor.id, created_at: iso(context.clock.now()), updated_at: iso(context.clock.now()),
      };
      course.slug = `course-${course.id}`;
      applyChange(context, course, body, true);
      context.db.courses.set(course.id, course);
      return created(authoringView(context.db, course, true));
    },
  },
  {
    method: 'POST', path: 'admin/courses',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const body = readObject(context);
      rejectUnknownFields(body, createFields);
      const owner = typeof body.instructor_id === 'string' ? context.db.users.get(body.instructor_id) : undefined;
      if (!owner || !owner.roles.includes('instructor')) throw validationFailed([{ field: 'instructor_id', code: 'invalid' }]);
      const course: CourseRecord = {
        id: nextId(context.db, 'crs'), slug: '', status: 'draft', title: '', subtitle: null, description: null, cover_url: null,
        category: '', level: '', price: null, instructor_id: owner.id, published_at: null, outcomes: [], chapters: [],
        internal_review_notes: '', revision: 1, ai_enabled: false, created_by: admin.id, created_at: iso(context.clock.now()), updated_at: iso(context.clock.now()),
      };
      course.slug = `course-${course.id}`;
      applyChange(context, course, body, true);
      context.db.courses.set(course.id, course);
      return created(authoringView(context.db, course, true));
    },
  },
  {
    method: 'GET', path: 'instructor/courses',
    handler: (context) => {
      const instructor = requireRole(context, 'instructor');
      const problems = queryProblems(context.query, ['limit', 'cursor']);
      const courses = [...context.db.courses.values()].filter((course) => course.instructor_id === instructor.id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
      const page = paginate(courses, context.query, context.config, problems);
      return ok({ items: page.items.map((course) => summary(context.db, course)), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'GET', path: 'admin/courses',
    handler: (context) => {
      requireRole(context, 'admin');
      const problems = queryProblems(context.query, ['status', 'limit', 'cursor']);
      const status = context.query.get('status');
      if (status !== null && !['draft', 'pending_review', 'approved', 'published'].includes(status)) problems.push({ field: 'status', code: 'invalid' });
      const courses = [...context.db.courses.values()].filter((course) => status === null || course.status === status)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
      const page = paginate(courses, context.query, context.config, problems);
      return ok({ items: page.items.map((course) => summary(context.db, course)), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'GET', path: 'courses/:id/authoring',
    handler: (context) => {
      const course = courseOr404(context.db, context.params.id);
      canManage(context, course);
      return ok(authoringView(context.db, course, true));
    },
  },
  {
    method: 'PATCH', path: 'courses/:id',
    handler: (context) => {
      const course = courseOr404(context.db, context.params.id);
      canManage(context, course);
      const body = readObject(context);
      const expected = requiredRevision(body);
      checkRevision(course, expected);
      const before = course.revision;
      applyChange(context, course, body);
      course.revision = before + 1;
      mutateStateAfterEdit(course, latestReview(context.db, course.id));
      course.updated_at = iso(context.clock.now());
      return ok(authoringView(context.db, course, true));
    },
  },
  {
    method: 'POST', path: 'courses/:id/videos/uploads',
    handler: (context) => {
      const course = courseOr404(context.db, context.params.id);
      canManage(context, course);
      throw new ApiError(503, 'video_upload_not_available', 'ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน');
    },
  },
  {
    method: 'GET', path: 'courses/:id/authoring-preview',
    handler: (context) => {
      const course = courseOr404(context.db, context.params.id);
      canManage(context, course);
      return ok({
        id: course.id, title: course.title, revision: course.revision,
        chapters: course.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, items: chapter.items.map((item) => itemView(item, false, false)) })),
      });
    },
  },
  {
    method: 'POST', path: 'courses/:id/submit-review',
    handler: (context) => {
      const course = courseOr404(context.db, context.params.id);
      canManage(context, course);
      const body = readObject(context);
      rejectUnknownFields(body, ['expected_revision']);
      checkRevision(course, requiredRevision(body));
      if (course.status !== 'draft') throw new ApiError(409, 'invalid_state', 'สถานะคอร์สไม่รองรับคำสั่งนี้');
      const fields: FieldError[] = [];
      if (!course.title.trim()) fields.push({ field: 'title', code: 'required' });
      if (!course.category.trim()) fields.push({ field: 'category', code: 'required' });
      if (!course.level.trim()) fields.push({ field: 'level', code: 'required' });
      if (!course.chapters.some((chapter) => chapter.items.length > 0)) fields.push({ field: 'chapters', code: 'required' });
      if (fields.length) throw validationFailed(fields);
      const review: ReviewRecord = {
        id: nextId(context.db, 'rev'), course_id: course.id, revision: course.revision, submitted_by: context.principal!.id,
        submitted_at: iso(context.clock.now()), status: 'pending', decided_by: null, decided_at: null, reason: null,
      };
      context.db.reviews.set(review.id, review);
      course.status = 'pending_review';
      course.updated_at = iso(context.clock.now());
      return created(reviewView(review));
    },
  },
  {
    method: 'GET', path: 'admin/course-reviews',
    handler: (context) => {
      requireRole(context, 'admin');
      const problems = queryProblems(context.query, ['status', 'limit', 'cursor']);
      const status = context.query.get('status');
      if (status !== null && !['pending', 'approved', 'returned', 'stale'].includes(status)) problems.push({ field: 'status', code: 'invalid' });
      const reviews = [...context.db.reviews.values()].filter((review) => status === null || review.status === status)
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at) || a.id.localeCompare(b.id));
      const page = paginate(reviews, context.query, context.config, problems);
      return ok({ items: page.items.map((review) => ({ ...reviewView(review), course: summary(context.db, context.db.courses.get(review.course_id) as CourseRecord) })), next_cursor: page.next_cursor });
    },
  },
  {
    method: 'GET', path: 'admin/course-reviews/:id',
    handler: (context) => {
      requireRole(context, 'admin');
      const review = context.db.reviews.get(context.params.id);
      if (!review) throw notFound();
      const course = courseOr404(context.db, review.course_id);
      return ok({ ...reviewView(review), course: authoringView(context.db, course, true) });
    },
  },
  {
    method: 'POST', path: 'admin/course-reviews/:id/approve',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const review = context.db.reviews.get(context.params.id);
      if (!review) throw notFound();
      const course = courseOr404(context.db, review.course_id);
      const body = readObject(context);
      rejectUnknownFields(body, ['expected_revision']);
      const expected = requiredRevision(body);
      if (review.status !== 'pending' || expected !== course.revision || review.revision !== course.revision) {
        throw new ApiError(409, 'revision_conflict', 'ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดแล้วตรวจอีกครั้ง', { details: { current_revision: course.revision } });
      }
      review.status = 'approved'; review.decided_by = admin.id; review.decided_at = iso(context.clock.now());
      course.status = 'approved'; course.updated_at = iso(context.clock.now());
      return ok(reviewView(review));
    },
  },
  {
    method: 'POST', path: 'admin/course-reviews/:id/return',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const review = context.db.reviews.get(context.params.id);
      if (!review) throw notFound();
      const course = courseOr404(context.db, review.course_id);
      const body = readObject(context);
      rejectUnknownFields(body, ['reason']);
      if (typeof body.reason !== 'string' || body.reason.trim() === '' || body.reason.length > 1000) throw validationFailed([{ field: 'reason', code: 'required' }]);
      if (review.status !== 'pending') throw new ApiError(409, 'invalid_state', 'สถานะ Review ไม่รองรับคำสั่งนี้');
      review.status = 'returned'; review.reason = body.reason; review.decided_by = admin.id; review.decided_at = iso(context.clock.now());
      course.status = 'draft'; course.updated_at = iso(context.clock.now());
      return ok(reviewView(review));
    },
  },
  {
    method: 'POST', path: 'courses/:id/publish',
    handler: (context) => {
      const admin = requireRole(context, 'admin');
      const course = courseOr404(context.db, context.params.id);
      if (course.status === 'published') return ok(authoringView(context.db, course, true));
      const approved = [...context.db.reviews.values()].find((review) => review.course_id === course.id && review.status === 'approved' && review.revision === course.revision);
      if (course.status !== 'approved' || !approved) throw new ApiError(409, 'invalid_state', 'สถานะคอร์สไม่รองรับคำสั่งนี้');
      course.status = 'published'; course.published_at = iso(context.clock.now()); course.updated_at = iso(context.clock.now());
      void admin;
      return ok(authoringView(context.db, course, true));
    },
  },
];
