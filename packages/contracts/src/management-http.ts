/** Canonical Draft HTTP types come from OpenAPI; runtime validators remain separate. */
export type {
  JsonValue,
  AuthoringQuestionDto,
  AuthoringItemDto,
  AuthoringChapterDto,
  CourseReviewDto,
  AuthoringCourseDto,
  ManagedCourseSummaryDto,
  CourseMetadataRequest,
  AuthoringQuestionWrite,
  AuthoringItemWrite,
  AuthoringChapterWrite,
  CoursePatchRequest,
  AdminUserSummaryDto,
  AdminUserDetailDto,
  LearnerRosterDto,
  ManagedAttemptDto,
  DashboardDto,
  PublicInstructorDto,
  AdminCreateUserRequest,
  CourseReviewRequest,
  CourseReturnRequest,
  QuestionGradeRequest,
  BlogRevisionRequest,
  ResourceValidationField,
  ResourceErrorDetails,
} from './generated/types.gen.ts';

/** Generic UI query pagination helper; concrete HTTP pages are generated. */
export interface ResourcePage<T> { items: T[]; next_cursor: string | null }
