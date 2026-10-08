import type { Course, CourseItem, User } from '@melearn/contracts';

export const createId = (prefix = 'id'): string =>
  `${prefix}-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;

export const flattenItems = (course?: Course | null): CourseItem[] =>
  course?.chapters?.flatMap((chapter) => chapter.items ?? []) ?? [];

export const formatPrice = (price: number | string): string =>
  Number(price) === 0 ? 'เรียนฟรี' : `฿${Number(price).toLocaleString('th-TH')}`;

export const instructorFor = (data: { users: User[] }, course?: Course | null): User | undefined =>
  data.users.find((user) => user.id === course?.instructorId);
