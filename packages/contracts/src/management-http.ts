/** Draft HTTP contracts. UI draft models in courses/assessment are not wire DTOs. */
import type { Money } from './common.ts';
import type { InstructorSummary, CourseStatus } from './courses.ts';
import type { Role } from './auth.ts';
import type { AccountProfile } from './profile.ts';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface ResourcePage<T> {
  items: T[];
  next_cursor: string | null;
}
export interface AuthoringQuestionDto {
  id: string;
  type: 'single_choice' | 'multiple_choice' | 'essay' | 'image';
  prompt: string;
  points: number;
  prompt_doc?: JsonValue | null;
  rubric?: string | null;
  response_mode?: 'text' | 'image' | 'either';
  options?: { id: string; text: string }[];
  correct_option_ids?: string[];
}
export interface AuthoringItemDto {
  id: string;
  type: 'video' | 'article' | 'quiz';
  title: string;
  video_url?: string;
  body?: string;
  body_doc?: JsonValue | null;
  description?: string;
  duration?: string;
  reading_minutes?: number;
  quiz?: { questions: AuthoringQuestionDto[]; pass_percent: number };
  has_history: boolean;
  has_ai_transcript?: boolean;
}
export interface AuthoringChapterDto {
  id: string;
  title: string;
  description?: string;
  items: AuthoringItemDto[];
}
export interface CourseReviewDto {
  id: string;
  revision: number;
  status: 'pending' | 'approved' | 'returned' | 'stale';
  submitted_by: string;
  submitted_at: string;
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
}
export interface AuthoringCourseDto {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_url: string | null;
  category: string;
  level: string;
  price: Money | null;
  outcomes: string[];
  instructor: InstructorSummary;
  chapters: AuthoringChapterDto[];
  status: CourseStatus;
  revision: number;
  published_at: string | null;
  published_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  latest_review: CourseReviewDto | null;
  ai_enabled: boolean;
  enrollment_count: number;
}
export interface ManagedCourseSummaryDto extends Omit<AuthoringCourseDto, 'chapters'> {
  chapters: {
    id: string;
    title: string;
    items: {
      id: string;
      type: 'video' | 'article' | 'quiz';
      title: string;
      quiz?: { question_count: number; pass_percent: number; attempt_count: number };
      has_history: boolean;
    }[];
  }[];
}
export interface CourseMetadataRequest {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  cover_url?: string | null;
  category?: string;
  level?: string;
  price?: Money | null;
  outcomes?: string[];
}
export interface AuthoringQuestionWrite extends Omit<
  AuthoringQuestionDto,
  'id' | 'options' | 'correct_option_ids'
> {
  id?: string;
  options?: { id?: string; text: string }[];
  correct_option_indices?: number[];
}
export interface AuthoringItemWrite extends Omit<
  AuthoringItemDto,
  'id' | 'quiz' | 'has_history' | 'has_ai_transcript'
> {
  id?: string;
  quiz?: { questions: AuthoringQuestionWrite[]; pass_percent: number };
}
export interface AuthoringChapterWrite {
  id?: string;
  title: string;
  description?: string;
  items: AuthoringItemWrite[];
}
export interface CoursePatchRequest extends Partial<CourseMetadataRequest> {
  expected_revision: number;
  instructor_id?: string;
  chapters?: AuthoringChapterWrite[];
}
export interface AdminUserSummaryDto {
  id: string;
  display_name: string;
  username: string | null;
  email: string | null;
  email_verified: boolean;
  avatar_url: string | null;
  roles: Role[];
  origin: 'self_email' | 'google' | 'admin_created';
  status: 'active' | 'pending';
  created_at: string;
}
export interface AdminUserDetailDto extends AdminUserSummaryDto {
  profile: AccountProfile;
  auth_methods: ('password' | 'google')[];
}
export interface LearnerRosterDto {
  id: string;
  course_id: string;
  user_id: string;
  learner_display_name: string;
  granted_at: string;
  completed_items: number;
  total_items: number;
  percent: number;
  completed_at: string | null;
  certificate: { id: string; code: string; learner_name: string; issued_at: string } | null;
}
export interface ManagedAttemptDto {
  id: string;
  course_id: string;
  item_id: string;
  user_id: string;
  learner_display_name: string;
  status: 'in_progress' | 'submitted' | 'pending_review' | 'graded';
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
  earned: number | null;
  max: number;
  passed: boolean | null;
  choice_earned: number;
  choice_max: number;
  questions: AuthoringQuestionDto[];
  answers: Record<string, { option_ids?: string[]; text?: string; image_url?: string }>;
  grades: Record<string, { score: number; comment: string | null }>;
}
export interface DashboardDto {
  course_count: number;
  enrollment_count: number;
  learner_count: number;
  pending_grading_count: number;
  user_count?: number;
  pending_course_count?: number;
}
export interface PublicInstructorDto {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface AdminCreateUserRequest {
  username: string;
  password: string;
  display_name: string;
  email?: string | null;
}
export interface CourseReviewRequest {
  expected_revision: number;
}
export interface CourseReturnRequest {
  reason: string;
}
export interface QuestionGradeRequest {
  score: number;
  comment: string | null;
}
export interface BlogRevisionRequest {
  expected_revision: number;
}
export interface ResourceValidationField {
  field: string;
  code: string;
}
export interface ResourceErrorDetails {
  fields?: ResourceValidationField[];
  current_revision?: number;
}
