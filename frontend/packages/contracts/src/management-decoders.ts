/** Runtime checks for draft management HTTP resources. No app, fetch or UI dependencies. */
type Check = (value: unknown) => void;
const fail = (): never => {
  throw new TypeError('Invalid HTTP resource');
};
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
};
const text: Check = (v) => {
  if (typeof v !== 'string') fail();
};
const identifier: Check = (v) => {
  text(v);
  if (!(v as string).trim()) fail();
};
const boolean: Check = (v) => {
  if (typeof v !== 'boolean') fail();
};
const number: Check = (v) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail();
};
const count: Check = (v) => {
  number(v);
  if (!Number.isSafeInteger(v) || (v as number) < 0) fail();
};
const positive: Check = (v) => {
  number(v);
  if ((v as number) <= 0) fail();
};
const revision: Check = (v) => {
  count(v);
  positive(v);
};
const date: Check = (v) => {
  text(v);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(v as string) || !Number.isFinite(Date.parse(v as string))) fail();
};
const nullable =
  (c: Check): Check =>
  (v) => {
    if (v !== null) c(v);
  };
const values =
  (...allowed: unknown[]): Check =>
  (v) => {
    if (!allowed.includes(v)) fail();
  };
const list =
  (c: Check): Check =>
  (v) => {
    if (!Array.isArray(v)) fail();
    for (const x of v as unknown[]) c(x);
  };
const object =
  (fields: Record<string, Check>, optional: string[] = []): Check =>
  (v) => {
    const x = record(v);
    for (const [k, check] of Object.entries(fields)) {
      if (!Object.hasOwn(x, k)) {
        if (optional.includes(k)) continue;
        fail();
      }
      check(x[k]);
    }
  };
const page = (c: Check): Check => object({ items: list(c), next_cursor: nullable(identifier) });
const map =
  (c: Check): Check =>
  (v) => {
    for (const [key, value] of Object.entries(record(v))) {
      identifier(key);
      c(value);
    }
  };
const uniqueIds = (v: unknown): void => {
  const ids = (v as Record<string, unknown>[]).map((x) => x.id);
  if (new Set(ids).size !== ids.length) fail();
};
const jsonDoc: Check = (value) => {
  if (value === null) return;
  if (record(value).type !== 'doc') fail();
  let visited = 0;
  const visit = (v: unknown, depth: number): void => {
    if (++visited > 20000 || depth > 30) fail();
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number') return number(v);
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    for (const [key, x] of Object.entries(record(v))) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
      if (
        ['href', 'src'].includes(key) &&
        typeof x === 'string' &&
        !/^(https?:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp);base64,)/i.test(x)
      )
        fail();
      visit(x, depth + 1);
    }
  };
  visit(value, 0);
  if (JSON.stringify(value).length > 2000000) fail();
};
const instructor = object({ id: identifier, display_name: text, avatar_url: nullable(text) });
const money = nullable(object({ amount_minor: count, currency: values('THB') }));
const roles = list(values('learner', 'instructor', 'admin'));
const profile = object(
  Object.fromEntries(
    [
      'bio',
      'firstName',
      'lastName',
      'firstNameEnglish',
      'lastNameEnglish',
      'certificateName',
      'birthDate',
      'phone',
      'school',
      'educationLevel',
    ]
      .map((k) => [k, text])
      .concat([
        ['interests', list(text)],
        ['learningGoals', list(text)],
      ]),
  ),
  [
    'bio',
    'firstName',
    'lastName',
    'firstNameEnglish',
    'lastNameEnglish',
    'certificateName',
    'birthDate',
    'phone',
    'school',
    'educationLevel',
    'interests',
    'learningGoals',
  ],
);
const identityFields = {
  id: identifier,
  display_name: text,
  username: nullable(text),
  email: nullable(text),
  email_verified: boolean,
  avatar_url: nullable(text),
  roles,
  origin: values('self_email', 'google', 'admin_created'),
};
const currentUser = object({
  ...identityFields,
  auth_methods: list(values('password', 'google')),
  learning_eligible: boolean,
  profile,
});
const userFields = { ...identityFields, status: values('active', 'pending'), created_at: date };
const userSummary = object(userFields);
const reviewFields = {
  id: identifier,
  revision,
  status: values('pending', 'approved', 'returned', 'stale'),
  submitted_by: identifier,
  submitted_at: date,
  decided_by: nullable(identifier),
  decided_at: nullable(date),
  reason: nullable(text),
};
const review = object(reviewFields);
const questionFields = {
  id: identifier,
  type: values('single_choice', 'multiple_choice', 'essay', 'image'),
  prompt: text,
  points: positive,
  prompt_doc: jsonDoc,
  rubric: nullable(text),
  response_mode: values('text', 'image', 'either'),
  options: list(object({ id: identifier, text })),
  correct_option_ids: list(identifier),
};
const questionOptional = ['prompt_doc', 'rubric', 'response_mode', 'options', 'correct_option_ids'];
const question =
  (keys: boolean): Check =>
  (v) => {
    object(questionFields, questionOptional)(v);
    const x = record(v);
    if (!keys && Object.hasOwn(x, 'correct_option_ids')) fail();
    if (x.type === 'single_choice' || x.type === 'multiple_choice') {
      if (!Array.isArray(x.options) || x.options.length < 2) fail();
      uniqueIds(x.options);
      if (keys) {
        list(identifier)(x.correct_option_ids);
        const ids = x.correct_option_ids as string[];
        if (
          ids.length < 1 ||
          new Set(ids).size !== ids.length ||
          (x.type === 'single_choice' && ids.length !== 1)
        )
          fail();
        if (ids.some((id) => !(x.options as { id: string }[]).some((o) => o.id === id))) fail();
      }
    }
  };
const itemKind = values('video', 'article', 'quiz');
const fullItem =
  (keys: boolean): Check =>
  (v) => {
    object(
      {
        id: identifier,
        type: itemKind,
        title: text,
        has_history: boolean,
        description: text,
        duration: text,
        reading_minutes: number,
        video_url: text,
        body: text,
        body_doc: jsonDoc,
        has_ai_transcript: boolean,
        quiz: object({ pass_percent: values(70), questions: list(question(keys)) }),
      },
      [
        'description',
        'duration',
        'reading_minutes',
        'video_url',
        'body',
        'body_doc',
        'has_ai_transcript',
        'quiz',
      ],
    )(v);
    const x = record(v);
    if (x.quiz !== undefined) {
      const quiz = record(x.quiz);
      uniqueIds(quiz.questions);
    }
  };
const courseFields = {
  id: identifier,
  slug: identifier,
  title: text,
  subtitle: nullable(text),
  description: nullable(text),
  cover_url: nullable(text),
  category: text,
  level: text,
  price: money,
  outcomes: list(text),
  instructor,
  status: values('draft', 'pending_review', 'approved', 'published', 'archived'),
  revision,
  published_at: nullable(date),
  published_by: nullable(identifier),
  created_by: identifier,
  created_at: date,
  updated_at: date,
  latest_review: nullable(review),
  ai_enabled: boolean,
  enrollment_count: count,
};
const fullCourse =
  (keys: boolean): Check =>
  (v) => {
    object({
      ...courseFields,
      chapters: list(
        object({ id: identifier, title: text, description: text, items: list(fullItem(keys)) }, [
          'description',
        ]),
      ),
    })(v);
    const chapters = record(v).chapters as { id: string; items: { id: string }[] }[];
    uniqueIds(chapters);
    uniqueIds(chapters.flatMap((c) => c.items));
  };
const coursePreview: Check = (v) => {
  if (Object.keys(record(v)).some((key) => !['id', 'title', 'revision', 'chapters'].includes(key)))
    fail();
  object({
    id: identifier,
    title: text,
    revision,
    chapters: list(object({ id: identifier, title: text, items: list(fullItem(false)) })),
  })(v);
  const chapters = record(v).chapters as { id: string; items: { id: string }[] }[];
  uniqueIds(chapters);
  uniqueIds(chapters.flatMap((c) => c.items));
};
const courseSummary = object({
  ...courseFields,
  chapters: list(
    object({
      id: identifier,
      title: text,
      items: list(
        object(
          {
            id: identifier,
            type: itemKind,
            title: text,
            has_history: boolean,
            quiz: object({ question_count: count, pass_percent: values(70), attempt_count: count }),
          },
          ['quiz'],
        ),
      ),
    }),
  ),
});
const certificate = object({
  id: identifier,
  code: identifier,
  learner_name: text,
  issued_at: date,
});
const roster: Check = (v) => {
  object({
    id: identifier,
    course_id: identifier,
    user_id: identifier,
    learner_display_name: text,
    granted_at: date,
    completed_items: count,
    total_items: count,
    percent: count,
    completed_at: nullable(date),
    certificate: nullable(certificate),
  })(v);
  const x = record(v);
  if ((x.percent as number) > 100 || (x.completed_items as number) > (x.total_items as number))
    fail();
};
const answers = map(
  object({ option_ids: list(identifier), text, image_url: text }, [
    'option_ids',
    'text',
    'image_url',
  ]),
);
const grades = map(object({ score: number, comment: nullable(text) }));
const attemptFields = {
  id: identifier,
  course_id: identifier,
  item_id: identifier,
  status: values('in_progress', 'submitted', 'pending_review', 'graded'),
  started_at: date,
  submitted_at: nullable(date),
  graded_at: nullable(date),
  earned: nullable(number),
  max: positive,
  passed: nullable(boolean),
  questions: list(question(false)),
  answers,
};
const managedAttempt: Check = (v) => {
  object({
    ...attemptFields,
    user_id: identifier,
    learner_display_name: text,
    choice_earned: number,
    choice_max: number,
    grades,
  })(v);
  const x = record(v);
  uniqueIds(x.questions);
  if (
    (x.choice_earned as number) < 0 ||
    (x.choice_max as number) < (x.choice_earned as number) ||
    (x.choice_max as number) > (x.max as number)
  )
    fail();
  if (x.earned !== null && ((x.earned as number) < 0 || (x.earned as number) > (x.max as number)))
    fail();
};
const gradeResponse = object({
  ...attemptFields,
  number: revision,
  percent: nullable(number),
  question_results: nullable(
    list(
      object({ question_id: identifier, score: number, max: positive, comment: nullable(text) }),
    ),
  ),
});
const queueItem = object({
  attempt_id: identifier,
  course_id: identifier,
  item_id: identifier,
  user_id: identifier,
  learner_display_name: text,
  submitted_at: date,
  questions_to_grade: list(
    object({
      question_id: identifier,
      type: values('essay', 'image'),
      prompt: text,
      max: positive,
      answer: object({ text, image_url: text }, ['text', 'image_url']),
    }),
  ),
});
const blogFields = {
  id: identifier,
  slug: identifier,
  title: text,
  category: text,
  cover_url: nullable(text),
  excerpt: nullable(text),
  reading_minutes: revision,
  author: object({ id: identifier, display_name: text }),
  published_at: nullable(date),
  content: text,
  content_doc: jsonDoc,
  status: values('draft', 'published'),
  author_id: identifier,
  editor_id: identifier,
  revision,
  created_at: date,
  updated_at: date,
};
const blog = object(blogFields);
const publicBlogFields = {
  id: identifier,
  slug: identifier,
  title: text,
  category: text,
  cover_url: nullable(text),
  excerpt: nullable(text),
  reading_minutes: revision,
  author: object({ id: identifier, display_name: text }),
  published_at: date,
};
const publicCourseFields = {
  id: identifier,
  slug: identifier,
  title: text,
  subtitle: nullable(text),
  cover_url: nullable(text),
  category: text,
  level: text,
  price: money,
  instructor,
  published_at: date,
  description: nullable(text),
  outcomes: list(text),
  outline: list(
    object({
      id: identifier,
      title: text,
      items: list(object({ id: identifier, type: itemKind, title: text })),
    }),
  ),
};
const publicCourse = object(publicCourseFields);

/** Fail closed for unregistered management endpoints. Add schema alongside new operation. */
export function decodeManagementResponse(path: string, method: string, payload: unknown): unknown {
  const p = path.split('?')[0].replace(/^\/+|\/+$/g, '');
  const m = method.toUpperCase();
  let check: Check | undefined;
  if (/^(admin|instructor)\/courses$/.test(p))
    check = m === 'GET' ? page(courseSummary) : m === 'POST' ? fullCourse(true) : undefined;
  else if (/^courses\/[^/]+\/authoring$/.test(p) && m === 'GET') check = fullCourse(true);
  else if (/^courses\/[^/]+\/authoring-preview$/.test(p) && m === 'GET') check = coursePreview;
  else if (/^courses\/[^/]+$/.test(p) && m === 'PATCH') check = fullCourse(true);
  else if (/^courses\/[^/]+\/publish$/.test(p) && m === 'POST') check = fullCourse(true);
  else if (/^courses\/[^/]+\/submit-review$/.test(p) && m === 'POST') check = review;
  else if (/^admin\/course-reviews\/[^/]+\/(approve|return)$/.test(p) && m === 'POST')
    check = review;
  else if (p === 'admin/course-reviews' && m === 'GET')
    check = page(object({ ...reviewFields, course: courseSummary }));
  else if (/^admin\/course-reviews\/[^/]+$/.test(p) && m === 'GET')
    check = object({ ...reviewFields, course: fullCourse(true) });
  else if (p === 'admin/users' && m === 'GET') check = page(userSummary);
  else if (p === 'admin/instructors' && m === 'GET') check = page(instructor);
  else if (p === 'admin/users' && m === 'POST')
    check = object({ user: currentUser, created_by: identifier, created_at: date });
  else if (/^admin\/users\/[^/]+\/instructor$/.test(p) && m === 'POST')
    check = object({ user: currentUser, added_by: nullable(identifier), added_at: nullable(date) });
  else if (/^admin\/users\/[^/]+$/.test(p) && m === 'GET')
    check = object({ ...userFields, profile, auth_methods: list(values('password', 'google')) });
  else if (
    /^(courses\/[^/]+\/learners|admin\/users\/[^/]+\/enrollments|(admin|instructor)\/learners)$/.test(
      p,
    ) &&
    m === 'GET'
  )
    check = page(roster);
  else if (/^(courses\/[^/]+\/attempts|admin\/users\/[^/]+\/attempts)$/.test(p) && m === 'GET')
    check = page(managedAttempt);
  else if (/^instructor\/attempts\/[^/]+$/.test(p) && m === 'GET') check = managedAttempt;
  else if (/^instructor\/attempts\/[^/]+\/questions\/[^/]+\/grade$/.test(p) && m === 'PUT')
    check = gradeResponse;
  else if (p === 'instructor/grading-queue' && m === 'GET') check = page(queueItem);
  else if (/^(admin|instructor)\/summary$/.test(p) && m === 'GET')
    check = object({
      course_count: count,
      enrollment_count: count,
      learner_count: count,
      pending_grading_count: count,
      ...(p.startsWith('admin') ? { user_count: count, pending_course_count: count } : {}),
    });
  else if (/^managed-quizzes\/[^/]+$/.test(p) && m === 'GET')
    check = object({ course_id: identifier, item_id: identifier });
  else if (/^instructors\/[^/]+$/.test(p) && m === 'GET')
    check = object({
      id: identifier,
      display_name: text,
      avatar_url: nullable(text),
      bio: nullable(text),
    });
  else if (/^instructors\/[^/]+\/courses$/.test(p) && m === 'GET') check = page(publicCourse);
  else if (/^admin\/courses\/[^/]+\/ai-support$/.test(p) && m === 'PATCH')
    check = object({ course_id: identifier, ai_enabled: boolean });
  else if (
    /^admin\/courses\/[^/]+\/videos\/[^/]+\/ai-transcript$/.test(p) &&
    ['GET', 'PUT'].includes(m)
  )
    check = object({
      item_id: identifier,
      text,
      edited_by: nullable(identifier),
      edited_at: nullable(date),
    });
  else if (p === 'blog' && m === 'GET') check = page(object(publicBlogFields));
  else if (/^blog\/[^/]+$/.test(p) && m === 'GET')
    check = object({ ...publicBlogFields, content: text, content_doc: jsonDoc });
  else if (p === 'admin/blog' && m === 'GET') check = page(blog);
  else if (p === 'admin/blog' && m === 'POST') check = blog;
  else if (/^admin\/blog\/[^/]+(\/preview)?$/.test(p) && ['GET', 'PATCH'].includes(m)) check = blog;
  else if (/^admin\/blog\/[^/]+\/(publish|unpublish)$/.test(p) && m === 'POST') check = blog;
  else if (/^admin\/blog\/[^/]+$/.test(p) && m === 'DELETE')
    check = object({ id: identifier, deleted: values(true) });
  if (!check) throw new TypeError('Unregistered HTTP resource');
  check(payload);
  return payload;
}
