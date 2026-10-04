// Frontend message blocks, not an approved backend response contract.
export type AiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'math'; latex: string }
  | { type: 'practice'; prompt: string; options: string[]; correctOption: number; explanation: string };

export interface AiContext {
  courseId?: string;
  attemptId?: string;
  questionId?: string;
  questionLabel?: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: AiContentBlock[];
  createdAt: string;
}

export interface AiThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  context: AiContext;
  draft: string;
  messages: AiMessage[];
}

export const AI_MATH_DEMO_PROMPT = 'ดูตัวอย่างคำตอบคณิตศาสตร์';
const storageKey = (userId: string) => `melearn-ai-threads-v1:${userId}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlock(value: unknown): value is AiContentBlock {
  if (!isRecord(value)) return false;
  if (value.type === 'text') return typeof value.text === 'string';
  if (value.type === 'math') return typeof value.latex === 'string';
  if (value.type !== 'practice') return false;
  return typeof value.prompt === 'string' && Array.isArray(value.options)
    && value.options.length > 0 && value.options.every((option) => typeof option === 'string')
    && typeof value.correctOption === 'number' && Number.isInteger(value.correctOption)
    && value.correctOption >= 0 && value.correctOption < value.options.length
    && typeof value.explanation === 'string';
}

function isMessage(value: unknown): value is AiMessage {
  return isRecord(value) && typeof value.id === 'string'
    && (value.role === 'user' || value.role === 'assistant')
    && typeof value.createdAt === 'string'
    && Array.isArray(value.blocks) && value.blocks.every(isBlock);
}

function readContext(value: unknown): AiContext {
  if (!isRecord(value)) return {};
  const context: AiContext = {};
  if (typeof value.courseId === 'string') context.courseId = value.courseId;
  if (typeof value.attemptId === 'string') context.attemptId = value.attemptId;
  if (typeof value.questionId === 'string') context.questionId = value.questionId;
  if (typeof value.questionLabel === 'string') context.questionLabel = value.questionLabel;
  return context;
}

export function loadAiThreads(userId: string): AiThread[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: AiThread[] = [];
    const ids = new Set<string>();
    for (const entry of parsed) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || ids.has(entry.id)
        || typeof entry.title !== 'string' || typeof entry.createdAt !== 'string'
        || typeof entry.updatedAt !== 'string' || typeof entry.draft !== 'string'
        || !Array.isArray(entry.messages) || !entry.messages.every(isMessage)) continue;
      ids.add(entry.id);
      result.push({
        id: entry.id, title: entry.title, createdAt: entry.createdAt,
        updatedAt: entry.updatedAt, draft: entry.draft,
        context: readContext(entry.context), messages: entry.messages,
      });
    }
    return result;
  } catch {
    return [];
  }
}

export function saveAiThreads(userId: string, threads: AiThread[]): boolean {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(threads));
    return true;
  } catch {
    return false;
  }
}

export function createAiThread(context: AiContext = {}): AiThread {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), title: 'แชตใหม่', createdAt: now, updatedAt: now,
    context: { ...context }, draft: '', messages: [],
  };
}

// Replace this adapter when a real model endpoint and authorization are available.
// Rendering and history do not depend on a particular model provider.
export function getDemoResponse(prompt: string, context: AiContext = {}): AiContentBlock[] {
  if (prompt === AI_MATH_DEMO_PROMPT) {
    return [
      { type: 'text', text: 'ตัวอย่างคำตอบคณิตศาสตร์: ลองแก้สมการกำลังสองนี้ทีละขั้นกัน' },
      { type: 'math', latex: 'x^2 - 5x + 6 = 0' },
      { type: 'text', text: '1. สูตรหาคำตอบของสมการ ax² + bx + c = 0 คือ' },
      { type: 'math', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
      { type: 'text', text: '2. แทนค่า a = 1, b = −5 และ c = 6' },
      { type: 'math', latex: 'x = \\frac{5 \\pm \\sqrt{25 - 24}}{2} = \\frac{5 \\pm 1}{2}' },
      { type: 'text', text: 'จึงได้คำตอบสองค่า ตรวจสอบได้ด้วยการแทนกลับลงในสมการเดิม' },
      { type: 'math', latex: 'x = 2 \\quad \\text{or} \\quad x = 3' },
      {
        type: 'practice', prompt: 'ลองต่ออีกข้อ: x² − 7x + 12 = 0 มีคำตอบใด?',
        options: ['x = 3 หรือ x = 4', 'x = 2 หรือ x = 6', 'x = 1 หรือ x = 12'],
        correctOption: 0, explanation: 'แยกตัวประกอบเป็น (x − 3)(x − 4) = 0 จึงได้ x = 3 หรือ x = 4',
      },
    ];
  }
  return [{
    type: 'text',
    text: context.questionLabel
      ? `มีบริบทจากแบบฝึกหัดนี้แล้ว: ${context.questionLabel}\n\nขณะนี้ยังไม่เชื่อมต่อโมเดล AI จึงยังตอบหรือค้นเนื้อหาคอร์สให้ไม่ได้ คำถามนี้เก็บไว้ในประวัติแชตแล้ว`
      : 'ขณะนี้ยังไม่เชื่อมต่อโมเดล AI จึงยังตอบหรือค้นเนื้อหาคอร์สให้ไม่ได้ คำถามนี้เก็บไว้ในประวัติแชตแล้ว คุณลองดูตัวอย่างคำตอบคณิตศาสตร์เพื่อดูรูปแบบสมการและโจทย์โต้ตอบในคำตอบได้',
  }];
}
