export type EnrollmentSource = 'free' | 'stripe' | 'redeem' | 'admin';

export interface Enrollment {
  id: string;
  courseId?: string;
  course_id?: string;
  userId?: string;
  user_id?: string;
  source?: EnrollmentSource;
  access?: 'lifetime';
  createdAt?: string;
  granted_at?: string;
  completed_at?: string | null;
}

export interface ProgressRecord {
  enrollment_id: string;
  item_id: string;
  completed: boolean;
  completed_at?: string | null;
  last_position_seconds?: number;
}

export interface ResumeState {
  item_id: string;
  item_type: 'video' | 'article' | 'quiz';
  position_seconds?: number;
  updated_at: string;
}

export interface LearningProgressSummary {
  course_id: string;
  total_items: number;
  completed_items: number;
  percent: number;
  completed: boolean;
  completed_at?: string | null;
  certificate_id?: string | null;
  resume?: ResumeState | null;
}
