export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AiConversation {
  id: string;
  title: string;
  course_id?: string | null;
  created_at: string;
  updated_at: string;
  messages?: AiMessage[];
}

export interface AiPracticeQuestion {
  id: string;
  prompt: string;
  options: string[];
  explanation?: string;
}

export interface AiQuota {
  daily_limit: number;
  used_today: number;
  remaining: number;
  resets_at: string;
}
