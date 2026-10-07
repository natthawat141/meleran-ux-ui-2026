import fractions from '../data/ai-practice-fractions.json';
import type { AiContentBlock } from '../pages/learner/ai-chat-model';

const MOCK_API_DELAY_MS = 650;
const MAX_FIXTURE_QUESTIONS = fractions.questions.length;

export interface AiPracticeRequest {
  topic: string;
  count: number;
}

export type AiPracticeMockResponse =
  | { ok: true; practice: Extract<AiContentBlock, { type: 'practice_set' }> }
  | { ok: false; block: Extract<AiContentBlock, { type: 'practice_notice' }> };

export function isAiPracticeCommand(prompt: string): boolean {
  return /^\s*\/quiz(?:\s|$)/i.test(prompt) || /สร้างแบบฝึกหัด/.test(prompt);
}

export function parseAiPracticeRequest(prompt: string): AiPracticeRequest | { error: string } {
  let remainder = prompt.trim();
  if (/^\/quiz(?:\s|$)/i.test(remainder)) remainder = remainder.replace(/^\/quiz\s*/i, '');
  else remainder = remainder.replace(/^สร้างแบบฝึกหัด(?:\s*เรื่อง)?\s*/u, '');

  const countMatch = remainder.match(/(?:^|\s)(\d+)\s*ข้อ/u);
  const count = countMatch ? Number(countMatch[1]) : 5;
  const topic = remainder.replace(/(?:^|\s)\d+\s*ข้อ/u, ' ').replace(/^เรื่อง\s*/u, '').trim().replace(/\s+/g, ' ');
  const normalizedTopic = topic.toLocaleLowerCase();

  if (!topic) return { error: 'ระบุหัวข้อที่ต้องการฝึกด้วย เช่น “สร้างแบบฝึกหัดเรื่องเศษส่วน 5 ข้อ”' };
  if (!['เศษส่วน', 'เศษส่วนพื้นฐาน', 'fraction', 'fractions', 'basic fractions'].includes(normalizedTopic)) {
    return { error: `ตอนนี้ชุดข้อมูลตัวอย่างยังรองรับเฉพาะหัวข้อ “เศษส่วน” ลองพิมพ์ “สร้างแบบฝึกหัดเรื่องเศษส่วน 5 ข้อ”` };
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_FIXTURE_QUESTIONS) {
    return { error: `ชุดข้อมูลตัวอย่างหัวข้อเศษส่วนมี ${MAX_FIXTURE_QUESTIONS} ข้อ เลือกจำนวน 1–${MAX_FIXTURE_QUESTIONS} ข้อได้` };
  }
  return { topic: fractions.topic, count };
}

/** Async API-shaped adapter backed only by local JSON. It does not call an AI model or backend. */
export async function requestAiPracticeMock(prompt: string): Promise<AiPracticeMockResponse> {
  await new Promise((resolve) => window.setTimeout(resolve, MOCK_API_DELAY_MS));
  const request = parseAiPracticeRequest(prompt);
  if ('error' in request) {
    return { ok: false, block: { type: 'practice_notice', id: crypto.randomUUID(), message: request.error } };
  }

  const id = crypto.randomUUID();
  const questions = fractions.questions.slice(0, request.count).map((question) => ({
    ...question,
    id: `${id}-${question.id}`,
  }));
  return {
    ok: true,
    practice: {
      type: 'practice_set', id, topic: fractions.topic,
      sourceLabel: 'ชุดข้อมูล JSON ตัวอย่าง · mock API · ไม่ได้ใช้โมเดล AI หรือเนื้อหาคอร์สที่เลือก',
      questions,
      answers: questions.map(() => null),
    },
  };
}
