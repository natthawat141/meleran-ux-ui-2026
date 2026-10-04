/**
 * Core Domain Models and Signatures for LMS Prototype
 * Strictly mirrors the mock database and runtime shapes
 */

import type { JSONContent } from '@tiptap/react';
import type { ProfileDetails, ProfileValues } from '../lib/profile-model';

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
  baseSharePercent?: number;
  referralSharePercent?: number;
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
  status: 'draft' | 'published' | 'archived';
  cover: string;
  chapters: Chapter[];
  outcomes?: string[];
  updatedAt?: string;
  createdAt?: string;
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
  assessmentStage?: 'pre_test' | 'practice' | 'post_test';
  comparisonSetId?: string;
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
  assignmentId?: string | null;
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
  referralLinkId?: string;
  referralCode?: string;
  referralInstructorId?: string;
}

export interface Order {
  id: string;
  courseId: string;
  userId: string;
  amount: number;
  listPrice?: number;
  discountAmount?: number;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  method?: string;
  source?: 'payment' | 'cash_code' | 'free_code';
  accessCodeId?: string;
  accessCode?: string;
  accessCodeKind?: AccessCodeKind;
  createdAt: string;
  instructorId?: string;
  instructorSharePercent?: number;
  instructorShareAmount?: number;
  platformShareAmount?: number;
  referralLinkId?: string;
  referralCode?: string;
  payoutStatus?: 'pending' | 'transferred' | 'not_applicable';
  payoutId?: string;
  paidOutAt?: string;
  demoFinance?: boolean;
}

export type AccessCodeKind = 'percent' | 'fixed' | 'free' | 'cash';

export interface AccessCode {
  id: string;
  code: string;
  courseId: string;
  kind: AccessCodeKind;
  value?: number;
  userId?: string;
  receivedAmount?: number;
  maxUses: number | null;
  usedCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

export interface CreateAccessCodeInput {
  courseId: string;
  kind: AccessCodeKind;
  code?: string;
  value?: number | null;
  userId?: string;
  receivedAmount?: number | null;
  maxUses?: number | null;
  expiresAt?: string;
}

export interface CreateAccessCodeResult extends ActionResult {
  accessCode?: AccessCode;
}

export interface CartItem {
  id: string;
  userId: string;
  courseId: string;
  createdAt: string;
  priceAlertEnabled: boolean;
  referralCode?: string;
}

export interface PriceAlertEmail {
  id: string;
  userId: string;
  to: string;
  courseId: string;
  courseTitle: string;
  previousPrice: number;
  newPrice: number;
  createdAt: string;
  status: 'mock-sent';
}

export interface ReferralLink {
  id: string;
  code: string;
  courseId: string;
  instructorId: string;
  createdAt: string;
}

export interface InstructorPayout {
  id: string;
  instructorId: string;
  amount: number;
  orderCount: number;
  orderIds: string[];
  createdAt: string;
}

export type CreateReferralLinkResult = { ok: true; link: ReferralLink } | { ok: false; message: string };
export type InstructorPayoutResult = { ok: true; payout: InstructorPayout } | { ok: false; message: string };

export interface Certificate {
  id: string;
  code: string;
  courseId: string;
  userId: string;
  issuedAt: string;
  recipientName?: string;
}

export interface InstructorRequest {
  id: string;
  userId?: string;
  userName: string;
  email: string;
  intro: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewNote?: string;
}

export interface InstructorInvite {
  id: string;
  token: string;
  userId?: string;
  name: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}

export interface Assignment {
  id: string;
  status?: 'active' | 'cancelled';
  instructions?: string;
  chapterId?: string;
  courseId: string;
  quizId: string;
  title: string;
  stage: 'pre_test' | 'practice' | 'post_test';
  assigneeType: 'all_enrolled' | 'specific';
  assigneeIds?: string[];
  dueDate?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ComparisonSet {
  id: string;
  title: string;
  courseId: string;
  preQuizId: string;
  postQuizId: string;
  description?: string;
  createdAt: string;
}

export interface InboxMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  readBy?: string[];
  context?: InboxSubjectContext;
  isDemo?: boolean;
  attachments?: InboxAttachment[];
}

export interface InboxAttachment {
  id: string;
  name: string;
  contentType: 'image/webp' | 'video/mp4' | 'video/webm';
  size: number;
  url: string;
}

export interface InboxAttachmentInput extends Omit<InboxAttachment, 'id'> {}

export interface InboxSubjectContext {
  courseId?: string;
  courseTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
  itemId?: string;
  itemTitle?: string;
  itemType?: string;
}

export interface InboxConversation {
  id: string;
  type?: 'course_inquiry' | 'support';
  courseId?: string | null;
  participantIds: string[];
  assignedAdminId?: string | null;
  subject?: string;
  context?: InboxSubjectContext;
  status?: 'open' | 'closed';
  lastMessageAt?: string;
  unreadCount?: Record<string, number> | number;
  createdAt?: string;
  isDemo?: boolean;
}

export interface LmsData {
  users: User[];
  currentUserId: string | null;
  courses: Course[];
  blogPosts: BlogPost[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  enrollments: Enrollment[];
  orders: Order[];
  accessCodes: AccessCode[];
  cartItems: CartItem[];
  mockPriceEmails: PriceAlertEmail[];
  referralLinks: ReferralLink[];
  instructorPayouts: InstructorPayout[];
  financeDemoSeedVersion?: string;
  certificates: Certificate[];
  instructorRequests: InstructorRequest[];
  invitations: InstructorInvite[];
  assignments?: Assignment[];
  comparisonSets?: ComparisonSet[];
  inboxConversations?: InboxConversation[];
  inboxMessages?: InboxMessage[];
  progress: Record<string, Record<string, boolean>>;
  inboxDemoVersion?: number;
  notifications?: Notification[];
}

export interface Notification {
  id: string;
  userId?: string;
  type: string;
  title: string;
  description: string;
  href?: string;
  conversationId?: string;
  createdAt?: string;
  readAt?: string | null;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
  user?: User;
}

export interface ReorderResult {
  ok: boolean;
  message?: string;
}

export interface WorkspaceSaveResult {
  ok: boolean;
  message?: string;
}

export interface SendInboxMessageArgs {
  conversationId?: string;
  recipientId?: string;
  courseId?: string;
  itemId?: string;
  chapterId?: string;
  text: string;
  attachments?: InboxAttachmentInput[];
}

export interface SendInboxMessageResult extends ActionResult {
  conversationId?: string;
}

export interface LmsContextType {
  data: LmsData;
  currentUser: User | null;
  signIn: (email: string, password?: string) => ActionResult;
  signInDemo: (role: Role) => ActionResult;
  signOut: () => void;
  register: (values: { name: string; email: string; password?: string }) => ActionResult;
  resetDemo: () => void;
  saveBlogPost: (values: Partial<BlogPost>, postId?: string) => string | null;
  removeBlogPost: (postId: string) => boolean;
  saveCourse: (values: Partial<Course>, courseId?: string) => string | null;
  removeCourse: (courseId: string) => void;
  saveChapter: (courseId: string, chapter: Partial<Chapter>, chapterId?: string) => void;
  saveChapterWorkspace: (courseId: string, chapter: Chapter, quizzes: Quiz[], baseline: string) => WorkspaceSaveResult;
  reorderCurriculum: (courseId: string, chapterId: string | null | undefined, orderedIds: string[]) => ReorderResult;
  removeChapter: (courseId: string, chapterId: string) => ActionResult;
  saveItem: (courseId: string, chapterId: string, values: Partial<CourseItem>) => void;
  removeItem: (courseId: string, chapterId: string, itemId: string) => ActionResult;
  saveQuiz: (values: Partial<Quiz>, quizId?: string) => string | null;
  removeQuiz: (quizId: string) => ActionResult;
  enrollFree: (courseId: string, userId?: string, referralCode?: string | null) => void;
  simulatePayment: (courseId: string, outcome: 'paid' | 'failed', referralCode?: string | null, accessCode?: string) => string | null;
  createAccessCode: (values: CreateAccessCodeInput) => CreateAccessCodeResult;
  setAccessCodeStatus: (accessCodeId: string, status: 'active' | 'inactive') => ActionResult;
  addCourseToCart: (courseId: string, referralCode?: string | null) => ActionResult & { alreadyAdded?: boolean };
  removeCourseFromCart: (cartItemId: string) => boolean;
  setCoursePriceAlert: (courseId: string, enabled: boolean) => boolean;
  createReferralLink: (courseId: string) => CreateReferralLinkResult;
  saveInstructorCommission: (userId: string, base: number, referral: number) => ActionResult;
  markInstructorPayout: (instructorId: string) => InstructorPayoutResult;
  markContentDone: (courseId: string, itemId: string) => void;
  startAttempt: (quiz: Quiz, assignmentId?: string | null) => string | null;
  saveAttemptDraft: (attemptId: string, answers: Record<string, QuizAnswerValue>) => void;
  submitAttempt: (quiz: Quiz, answers: Record<string, QuizAnswerValue>, existingAttemptId?: string) => string | null;
  gradeAttempt: (attemptId: string, grading: { score: number; feedback?: string }) => ActionResult;
  requestInstructor: (values: { name?: string; email?: string; intro: string }) => void;
  reviewInstructorRequest: (requestId: string, decision: 'approved' | 'rejected', note?: string) => void;
  createInstructorInvite: (invite: { name: string; email: string }) => string;
  acceptInstructorInvite: (token: string, password?: string) => ActionResult;
  changeUserRole: (userId: string, role: Role) => void;
  updateProfile: (values: ProfileValues) => ActionResult;
  resetPassword: (email: string, password?: string) => ActionResult;
  saveAssignment: (values: Partial<Assignment>, assignmentId?: string) => ActionResult & { assignment?: Assignment };
  removeAssignment: (assignmentId: string) => ActionResult;
  cancelAssignment: (assignmentId: string) => ActionResult;
  saveComparisonSet: (values: Partial<ComparisonSet>, comparisonSetId?: string) => string;
  markNotificationRead: (notificationId: string) => void;
  sendInboxMessage: (args: SendInboxMessageArgs) => SendInboxMessageResult;
  markInboxConversationRead: (conversationId: string) => void;
}

export type {
  ReviewQueueOptions,
  ReviewQueueItem,
  CourseAnalyticsRow,
  InstructorAnalyticsResult,
  LearnerAnalyticsRow,
  AssessmentSummaryRow,
  CourseAnalyticsResult,
  LearnerTimelineEvent,
  LearnerAssessmentRecord,
  LearnerCourseAnalyticsResult,
  PairedLearnerResult,
  PrePostComparisonResult,
} from '../api/analytics';

export type CourseAssessmentRow = import('../api/analytics').AssessmentSummaryRow;
export type CourseLearnerRow = import('../api/analytics').LearnerAnalyticsRow;
export type LearnerAssessmentItem = import('../api/analytics').LearnerAssessmentRecord;
export type PrePostLearnerResult = import('../api/analytics').PairedLearnerResult;
export type AnalyticsCourseRow = import('../api/analytics').CourseAnalyticsRow;
export type ReviewQueueEntry = import('../api/analytics').ReviewQueueItem;
