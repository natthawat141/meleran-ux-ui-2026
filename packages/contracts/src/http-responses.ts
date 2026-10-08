// Draft HTTP response DTOs used by app decoders. Internal records and UI models are separate.

export interface WireLearningEnrollment {
  enrollment: { id: string; course_id: string; source: string; access: string; granted_at: string };
  course: { id: string; title: string; subtitle: string | null; cover_url: string | null; category: string; level: string; instructor: { id: string; display_name: string } };
  progress: { completed_items: number; total_items: number; completed_at: string | null };
}
export interface WireLearningItem {
  id: string; type: 'video' | 'article' | 'quiz'; title: string; completed_at: string | null;
  resume: { position_seconds: number; updated_at: string } | null;
}
export interface WireLearningCourse {
  id: string; title: string; subtitle: string | null; cover_url: string | null; category: string; level: string;
  instructor: { id: string; display_name: string };
  access: { mode: 'enrolled'; enrollment: WireLearningEnrollment['enrollment'] };
  outline: Array<{ id: string; title: string; items: WireLearningItem[] }>;
  progress: WireLearningEnrollment['progress']; resume_item_id: string | null; certificate_id: string | null;
}
export interface WireLearningItemContent { id: string; type: WireLearningItem['type']; title: string; video_url?: string | null; body?: string | null; quiz?: { question_count: number; max_score: number } }

export interface WireAttemptQuestion { id: string; type: 'single_choice' | 'multiple_choice' | 'essay' | 'image'; prompt: string; points: number; options: Array<{ id: string; text: string }> }
export interface WireAttemptView {
  id: string; item_id: string; course_id: string; number: number;
  status: 'in_progress' | 'pending_review' | 'graded'; started_at: string; submitted_at: string | null; graded_at: string | null;
  questions: WireAttemptQuestion[]; answers: Record<string, { option_ids?: string[]; text?: string; image_url?: string }>;
  max: number; earned: number | null; percent: number | null; passed: boolean | null;
  question_results: Array<{ question_id: string; score: number; max: number; comment: string | null }> | null;
}
export interface WireGradingQueueItem {
  attempt_id: string; course_id: string; item_id: string; learner_display_name: string; submitted_at: string;
  questions_to_grade: Array<{ question_id: string; type: 'essay' | 'image'; prompt: string; max: number; answer: { text?: string; image_url?: string } }>;
}

export interface WirePaymentView {
  payment_id: string; course_id: string; status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  fulfillment_status: 'pending' | 'granted' | 'failed'; enrollment: { id: string; course_id: string; source: string } | null;
}
export interface WireCheckoutResult { payment_id: string; checkout_url: string; already_enrolled?: false }
export interface WireRedeemResult { already_enrolled: boolean; enrollment: { id: string; course_id: string; source: string; access: string; granted_at: string } }

export interface WireServerCertificate { id: string; code: string; course_id: string; course_title: string; learner_name: string; issued_at: string; enrollment_id: string }

export interface WireAiConversation { id: string; title: string; course_id: string | null; created_at: string; updated_at: string }
export interface WireAiOption { id: string; text: string }
export interface WireAiPracticeQuestion { id: string; prompt: string; options: WireAiOption[]; answered: boolean; my_option_id?: string; result?: { correct: boolean; explanation: string } }
export interface WireAiMessage { id: string; role: 'user' | 'assistant'; kind: string; content: string; status: string; request_id: string; created_at: string; completed_at: string | null; error_code: string | null; practice: { topic_id: string; questions: WireAiPracticeQuestion[] } | null }
export interface WireAiUsage { limit: number; used: number; remaining: number; reset_at: string }
export interface WireAiContextCourse { id: string; title: string }
export interface WireAiPracticeAnswer { question_id: string; correct: boolean; explanation: string; summary: { answered: number; total: number; correct_count: number } | null }

export interface WireAdminAiCourse { id: string; title: string; status: string }
export interface WireAdminAiVideo { id: string; title: string; type: 'video' | 'article' | 'quiz'; has_ai_transcript: boolean }
export interface WireAdminAiAuthoring { id: string; title: string; status: string; ai_enabled: boolean; chapters: Array<{ id: string; title: string; items: WireAdminAiVideo[] }> }
export interface WireAdminTranscript { item_id: string; text: string; edited_by: string | null; edited_at: string | null }

export interface WireRedeemAdminCourse { id: string; title: string; price: { amount_minor: number; currency: string } }
export interface WireAdminRedeemCode { id: string; code_masked: string; course_id: string; status: 'unused' | 'used' | 'revoked'; created_at: string; used_by: string | null; used_at: string | null; revoked_at: string | null }

export interface WireAdminPayment {
  payment_id: string;
  course_id: string;
  user_id: string;
  request_id: string;
  checkout_session_id: string;
  amount: { amount_minor: number; currency: string };
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  fulfillment_status: 'pending' | 'granted' | 'failed';
  enrollment: { id: string; course_id: string; source: string } | null;
  created_at: string;
  events: Array<{ event_id: string; type: string; received_at: string; processed_at: string | null; outcome: string }>;
}
