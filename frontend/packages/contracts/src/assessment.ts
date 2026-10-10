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

export interface GradingQueueItem {
  attempt_id: string;
  course_id: string;
  quiz_id: string;
  user_id: string;
  submitted_at: string;
  essay_questions: {
    question_id: string;
    prompt: string;
    response: QuizAnswerValue;
    rubric?: string;
    max_points: number;
  }[];
}

export interface GradingSubmission {
  attempt_id: string;
  scores: Record<string, number>;
  feedback?: string;
}
