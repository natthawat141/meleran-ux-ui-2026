import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ACCESS_DAYS, lessonById, teacherById } from './content.js';
import { tutorReply } from './tutor.js';

const KEY = 'melearn-chat-v1';
const ChatContext = createContext(null);

function emptyState() {
  return { lang: 'th', name: 'นที', wallet: null, unlocks: {}, progress: {}, threads: {} };
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!stored || typeof stored !== 'object') return emptyState();
    return { ...emptyState(), ...stored, unlocks: stored.unlocks || {}, progress: stored.progress || {}, threads: stored.threads || {} };
  } catch {
    return emptyState();
  }
}

function uid() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function progressOf(data, lessonId) {
  return data.progress[lessonId] ?? { step: 0, passed: false, hints: 0, updatedAt: 0 };
}

export function isUnlocked(lesson, data, now = Date.now()) {
  if (!lesson || lesson.free) return true;
  const unlock = data.unlocks[lesson.id];
  return Boolean(unlock && unlock.until > now);
}

export function ChatProvider({ children }) {
  const [data, setData] = useState(loadState);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [data]);

  const api = useMemo(() => ({
    setLang(lang) { setData((prev) => ({ ...prev, lang })); },
    setName(name) { setData((prev) => ({ ...prev, name })); },
    connectWallet() {
      setData((prev) => ({ ...prev, wallet: { address: 'So1aDemoWa11etMelearn7F3a', cluster: 'devnet' } }));
    },
    disconnectWallet() { setData((prev) => ({ ...prev, wallet: null })); },
    reset() { setData(emptyState()); },
    ensureThread(lessonId) {
      setData((prev) => {
        if (prev.threads[lessonId]?.length) return prev;
        const lesson = lessonById(lessonId);
        if (!lesson) return prev;
        const prompt = lesson.steps[0].prompt[prev.lang] ?? lesson.steps[0].prompt.th;
        return {
          ...prev,
          threads: { ...prev.threads, [lessonId]: [{ id: uid(), role: 'teacher', text: prompt }] },
          progress: { ...prev.progress, [lessonId]: { step: 0, passed: false, hints: 0, updatedAt: Date.now() } },
        };
      });
    },
    addLearnerMessage(lessonId, message) {
      setData((prev) => ({
        ...prev,
        threads: { ...prev.threads, [lessonId]: [...(prev.threads[lessonId] ?? []), { id: uid(), role: 'learner', ...message }] },
      }));
    },
    planReply(lessonId, action, text) {
      const snapshot = dataRef.current;
      const lesson = lessonById(lessonId);
      const teacher = teacherById(lesson.teacherId);
      return tutorReply({ lesson, teacher, progress: progressOf(snapshot, lessonId), text, action, lang: snapshot.lang });
    },
    commitReply(lessonId, result) {
      setData((prev) => {
        const current = progressOf(prev, lessonId);
        const next = {
          step: result.step ?? current.step,
          passed: result.passed ?? current.passed,
          hints: result.hints ?? current.hints,
          updatedAt: Date.now(),
        };
        const additions = result.messages.map((text) => ({ id: uid(), role: 'teacher', text }));
        return {
          ...prev,
          progress: { ...prev.progress, [lessonId]: next },
          threads: { ...prev.threads, [lessonId]: [...(prev.threads[lessonId] ?? []), ...additions] },
        };
      });
    },
    unlockLesson(lessonId) {
      const until = Date.now() + ACCESS_DAYS * 24 * 60 * 60 * 1000;
      setData((prev) => ({
        ...prev,
        unlocks: { ...prev.unlocks, [lessonId]: { until, ref: `demo-${lessonId}`, paidAt: Date.now() } },
      }));
    },
  }), []);

  return <ChatContext.Provider value={{ data, ...api }}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat ต้องอยู่ภายใน ChatProvider');
  return value;
}
