/**
 * Core Domain Models and Signatures for LMS Prototype
 * Strictly mirrors the mock database and runtime shapes
 */

import type { JSONContent } from '@tiptap/react';
import type { ProfileDetails, ProfileValues } from './lib/profile-model';

export type Role = 'learner' | 'instructor' | 'admin';

export interface User extends ProfileDetails {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  bio?: string;
  avatar?: string;
  status?: 'active' | 'suspended' | 'pending' | 'invited';
  /** False is set only for accounts created through the self-service email flow. Missing means a legacy/admin account. */
  emailVerified?: boolean;
}

export interface DemoAccount {
  label: string;
  email: string;
  password?: string;
  role: Role;
}

export interface BlogPost {
  id: string;
  title: string;
  category: string;
  coverKey?: string;
  cover?: string;
  excerpt: string;
  body: string;
  bodyDoc?: JSONContent | null;
  authorId: string;
  status: 'draft' | 'published';
  readingMinutes?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface VideoItem {
  id: string;
  type: 'video';
  title: string;
  videoUrl?: string;
  duration?: string;
  description?: string;
  summary?: string;
  videoFilename?: string;
  /** Admin-managed AI knowledge metadata. Never render this field in learner-facing UI. */
  transcript?: string;
  transcriptUpdatedAt?: string;
  transcriptUpdatedBy?: string;
}

export interface ArticleItem {
  id: string;
  type: 'article';
  title: string;
  content?: string;
  articleBody?: string;
  articleDoc?: unknown;
  readingMinutes?: number;
}

export interface QuizItem {
  id: string;
  type: 'quiz';
  title: string;
  quizId: string;
  duration?: string;
}

export type CourseItemType = 'article' | 'video' | 'quiz';
export type CourseItem = VideoItem | ArticleItem | QuizItem;

export interface Chapter {
  id: string;
  title: string;
  description?: string;
  items: CourseItem[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  level: string;
  price: number;
  instructorId: string;
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';
  cover: string;
  chapters: Chapter[];
  outcomes?: string[];
  updatedAt?: string;
  createdAt?: string;
  reviewHistory?: CourseReviewEvent[];
  /** Admin-managed AI knowledge setting; absent legacy values are treated as disabled. */
  aiEnabled?: boolean;
}

export interface CourseReviewEvent {
  action: 'submitted' | 'approved' | 'returned' | 'published' | 'approval_invalidated';
  actorId: string;
  at: string;
  reason?: string;
}

export interface EmailVerification {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  lastSentAt: string;
}

export interface ChoiceQuestion {
  id: string;
  type: 'choice';
  prompt: string;
  promptDoc?: unknown;
  options: string[];
  answer: number;
  points: number;
}

export interface EssayQuestion {
  id: string;
  type: 'essay';
  prompt: string;
  promptDoc?: unknown;
  responseMode?: 'text' | 'image' | 'either';
  rubric?: string;
  points: number;
}

export type Question = ChoiceQuestion | EssayQuestion;

export interface Quiz {
  id: string;
  courseId: string;
  chapterId?: string;
  title: string;
  passPercent: number;
  questions: Question[];
}

export interface AttemptAnswerImage {
  id: string;
  name?: string;
  url: string;
}

export interface AttemptAnswerEssay {
  text?: string;
  image?: string;
  images?: AttemptAnswerImage[];
}

export type QuizAnswerValue = number | string | AttemptAnswerEssay | unknown;

export interface QuizAttempt {
  id: string;
  quizSnapshot?: Quiz;
  startedAt?: string;
  quizId: string;
  courseId: string;
  userId: string;
  answers: Record<string, QuizAnswerValue>;
  score?: number;
  maxChoice?: number;
  percent?: number;
  essayStatus: 'none' | 'pending' | 'graded';
  essayScore?: number;
  essayFeedback?: string;
  totalScore?: number;
  maxScore?: number;
  finalPercent?: number;
  passed: boolean | null;
  status: 'in_progress' | 'draft' | 'submitted';
  submittedAt?: string;
  gradedAt?: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  createdAt: string;
}

export type RedeemCodeStatus = 'unused' | 'used' | 'revoked';

export interface RedeemCode {
  id: string;
  code: string;
  courseId: string;
  status: RedeemCodeStatus;
  createdAt: string;
  createdBy: string;
  usedByUserId?: string;
  usedAt?: string;
  enrollmentId?: string;
  revokedBy?: string;
  revokedAt?: string;
}

export interface CreateRedeemCodeResult extends ActionResult {
  redeemCode?: RedeemCode;
}

export type RedeemCourseCodeResult =
  | { ok: true; enrollmentId: string; redeemCodeId: string; alreadyEnrolled: boolean }
  | { ok: false; message: string };

export interface LegacyPrototypeSnapshot {
  /** Raw retired collections kept only so older browser data and result links remain recoverable. */
  collections: Record<string, unknown>;
}

export interface Certificate {
  id: string;
  code: string;
  courseId: string;
  userId: string;
  issuedAt: string;
  recipientName?: string;
}

export interface LmsData {
  users: User[];
  emailVerifications?: EmailVerification[];
  currentUserId: string | null;
  courses: Course[];
  blogPosts: BlogPost[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  enrollments: Enrollment[];
  redeemCodes: RedeemCode[];
  certificates: Certificate[];
  legacyPrototype?: LegacyPrototypeSnapshot;
  progress: Record<string, Record<string, boolean>>;
  notifications?: Notification[];
}

export interface Notification {
  id: string;
  userId?: string;
  type: string;
  title: string;
  description: string;
  href?: string;
  createdAt?: string;
  readAt?: string | null;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
  user?: User;
  verificationUrl?: string;
}

export interface SaveTranscriptResult extends ActionResult {
  updatedAt?: string;
  updatedBy?: string;
}

export interface ReorderResult {
  ok: boolean;
  message?: string;
}

export interface WorkspaceSaveResult {
  ok: boolean;
  message?: string;
}

export interface LmsContextType {
  data: LmsData;
  currentUser: User | null;
  signIn: (identifier: string, password?: string, requiredRole?: Role) => ActionResult;
  signInDemo: (role: Role) => ActionResult;
  signOut: () => void;
  register: (values: { name: string; email: string; password?: string }) => ActionResult;
  verifyEmail: (token: string) => ActionResult;
  resendVerificationEmail: () => ActionResult;
  simulateGoogleAuth: (email: string) => ActionResult;
  resetDemo: () => void;
  saveBlogPost: (values: Partial<BlogPost>, postId?: string) => string | null;
  removeBlogPost: (postId: string) => boolean;
  saveCourse: (values: Partial<Course>, courseId?: string) => string | null;
  submitCourseForReview: (courseId: string) => ActionResult;
  reviewCourse: (courseId: string, decision: 'approve' | 'return', reason?: string) => ActionResult;
  publishCourse: (courseId: string) => ActionResult;
  setCourseAiEnabled: (courseId: string, enabled: boolean) => ActionResult;
  saveVideoTranscript: (courseId: string, chapterId: string, videoId: string, transcript: string) => SaveTranscriptResult;
  saveChapter: (courseId: string, chapter: Partial<Chapter>, chapterId?: string) => void;
  saveChapterWorkspace: (courseId: string, chapter: Chapter, quizzes: Quiz[], baseline: string) => WorkspaceSaveResult;
  reorderCurriculum: (courseId: string, chapterId: string | null | undefined, orderedIds: string[]) => ReorderResult;
  removeChapter: (courseId: string, chapterId: string) => ActionResult;
  saveItem: (courseId: string, chapterId: string, values: Partial<CourseItem>) => void;
  removeItem: (courseId: string, chapterId: string, itemId: string) => ActionResult;
  saveQuiz: (values: Partial<Quiz>, quizId?: string) => string | null;
  removeQuiz: (quizId: string) => ActionResult;
  enrollFree: (courseId: string) => ActionResult;
  redeemCourseCode: (code: string) => RedeemCourseCodeResult;
  createRedeemCode: (courseId: string) => CreateRedeemCodeResult;
  revokeRedeemCode: (redeemCodeId: string) => ActionResult;
  markContentDone: (courseId: string, itemId: string) => void;
  startAttempt: (quiz: Quiz) => string | null;
  saveAttemptDraft: (attemptId: string, answers: Record<string, QuizAnswerValue>) => void;
  submitAttempt: (quiz: Quiz, answers: Record<string, QuizAnswerValue>, existingAttemptId?: string) => string | null;
  gradeAttempt: (attemptId: string, grading: { score: number; feedback?: string }) => ActionResult;
  assignInstructorRole: (userId: string) => ActionResult;
  updateProfile: (values: ProfileValues) => ActionResult;
  resetPassword: (email: string, password?: string) => ActionResult;
  markNotificationRead: (notificationId: string) => void;
}

export type { ReviewQueueOptions, ReviewQueueItem } from './lib/assessment-review';
