import type { WireLearningEnrollment as LearningEnrollment, WireLearningItem as LearningItem, WireLearningCourse as LearningCourse, WireLearningItemContent as LearningItemContent } from '@melearn/contracts';
export type { WireLearningEnrollment as LearningEnrollment, WireLearningItem as LearningItem, WireLearningCourse as LearningCourse, WireLearningItemContent as LearningItemContent } from '@melearn/contracts';
import { apiClient as http } from '../../../shared/api/client';
import { decodeEnrollmentDto } from '@melearn/contracts';
import { decodeCourseSummary } from '../../courses/api/catalog-provisional-contract.ts';

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid provisional learning response');
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => typeof value === 'string' ? value : (() => { throw new TypeError('Invalid provisional learning response'); })();
const nullableText = (value: unknown): string | null => value === null ? null : text(value);

function decodeEnrollmentList(value: unknown): LearningEnrollment[] {
  const list = object(value).items;
  if (!Array.isArray(list)) throw new TypeError('Invalid enrollment list');
  return list.map((entry) => {
    const record = object(entry); const enrollment = object(record.enrollment); const course = object(record.course);
    const progress = object(record.progress);
    if (typeof progress.completed_items !== 'number' || typeof progress.total_items !== 'number') throw new TypeError('Invalid progress');
    return {
      enrollment: decodeEnrollmentDto(enrollment),
      course: decodeCourseSummary(course),
      progress: { completed_items: progress.completed_items, total_items: progress.total_items, completed_at: nullableText(progress.completed_at) },
    };
  });
}

function decodeLearningCourse(value: unknown): LearningCourse {
  const record = object(value); const access = object(record.access); const enrollment = object(access.enrollment);
  if (access.mode !== 'enrolled') throw new TypeError('Invalid learning access mode');
  const progress = object(record.progress);
  if (!Array.isArray(record.outline) || typeof progress.completed_items !== 'number' || typeof progress.total_items !== 'number') throw new TypeError('Invalid learning course');
  return {
    ...decodeCourseSummary(record),
    access: { mode: 'enrolled', enrollment: decodeEnrollmentDto(enrollment) },
    outline: record.outline.map((chapter) => { const row = object(chapter); if (!Array.isArray(row.items)) throw new TypeError('Invalid outline'); return { id: text(row.id), title: text(row.title), items: row.items.map((item) => { const itemRow = object(item); return { id: text(itemRow.id), type: text(itemRow.type) as LearningItem['type'], title: text(itemRow.title), completed_at: nullableText(itemRow.completed_at), resume: itemRow.resume === null ? null : { position_seconds: object(itemRow.resume).position_seconds === null ? null : Number(object(itemRow.resume).position_seconds), updated_at: text(object(itemRow.resume).updated_at) } }; }) }; }),
    progress: { completed_items: progress.completed_items, total_items: progress.total_items, completed_at: nullableText(progress.completed_at) },
    resume_item_id: nullableText(record.resume_item_id), certificate_id: nullableText(record.certificate_id),
  };
}

function decodeItem(value: unknown): LearningItemContent {
  const record = object(value);
  return { id: text(record.id), type: text(record.type) as LearningItem['type'], title: text(record.title),
    ...(record.video_url !== undefined ? { video_url: nullableText(record.video_url) } : {}),
    ...(record.body !== undefined ? { body: nullableText(record.body),body_doc:(record.body_doc??null) as LearningItemContent['body_doc'] } : {}),
    ...(record.quiz !== undefined ? { quiz: object(record.quiz) as { question_count: number; max_score: number } } : {}) };
}

export const learningApi = {
  myEnrollments: (signal?: AbortSignal) => http.request('me/enrollments', { method: 'GET', signal, decoder: decodeEnrollmentList }),
  course: (id: string, signal?: AbortSignal) => http.request(`learn/courses/${encodeURIComponent(id)}`, { method: 'GET', signal, decoder: decodeLearningCourse }),
  item: (courseId: string, itemId: string, signal?: AbortSignal) => http.request(`learn/courses/${encodeURIComponent(courseId)}/items/${encodeURIComponent(itemId)}`, { method: 'GET', signal, decoder: decodeItem }),
  complete: (itemId: string) => http.request(`learn/items/${encodeURIComponent(itemId)}/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', decoder: (value) => object(value) }),
  resume: (itemId: string, positionSeconds: number) => http.request(`learn/items/${encodeURIComponent(itemId)}/resume`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ position_seconds: positionSeconds }), decoder: (value) => object(value) }),
};
