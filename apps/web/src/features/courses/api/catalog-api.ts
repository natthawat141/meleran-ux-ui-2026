import { HttpClientError } from '@melearn/api-client';
import type { HttpClient } from '@melearn/api-client';
import { decodeCourseDetail, decodeCoursePage, decodeCourseSummary } from './catalog-provisional-contract.ts';
import type { ProvisionalCourseDetail, ProvisionalCoursePage, ProvisionalCourseSummary } from './catalog-provisional-contract.ts';

// Read-only public catalog client built on the generic HTTP transport.
// Endpoints (`GET courses`, `GET courses/{id}`) and query names are PROVISIONAL candidates from
// docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md. This module never imports or falls back to a mock: the caller
// decides which HttpClient (and therefore which fetcher) it receives, and any failure is surfaced unchanged.

export interface CatalogListQuery {
  q?: string;
  category?: string;
  level?: string;
  priceType?: 'free' | 'paid';
  limit?: number;
  cursor?: string;
}

export interface CatalogRequestOptions {
  signal?: AbortSignal;
}

export interface CatalogApi {
  listCourses(query?: CatalogListQuery, options?: CatalogRequestOptions): Promise<ProvisionalCoursePage>;
  /** Resolves null only for HTTP 404. Every other failure rejects so the UI cannot show a false "not found". */
  getCourse(courseId: string, options?: CatalogRequestOptions): Promise<ProvisionalCourseDetail | null>;
  enrollFree(courseId: string): Promise<{ id: string; course_id: string; source: string; access: string; granted_at: string }>;
  getMyEnrollments(options?: CatalogRequestOptions): Promise<Array<{ enrollment: { id: string; course_id: string; source: string; access: string; granted_at: string }; course: ProvisionalCourseSummary; progress: { completed_items: number; total_items: number; completed_at: string | null } }>>;
}

const jsonHeaders = { accept: 'application/json' };

function decodeEnrollment(value: unknown) {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid provisional enrollment');
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.course_id !== 'string' || typeof record.source !== 'string'
    || typeof record.access !== 'string' || typeof record.granted_at !== 'string') throw new TypeError('Invalid provisional enrollment');
  return record as { id: string; course_id: string; source: string; access: string; granted_at: string };
}

function decodeEnrollmentPage(value: unknown) {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { items?: unknown }).items)) throw new TypeError('Invalid provisional enrollment page');
  return (value as { items: unknown[] }).items.map((item) => {
    if (!item || typeof item !== 'object') throw new TypeError('Invalid provisional enrollment item');
    const record = item as Record<string, unknown>;
    const enrollment = decodeEnrollment(record.enrollment);
    const course = decodeCourseSummary(record.course);
    const progress = record.progress as Record<string, unknown>;
    if (!progress || typeof progress.completed_items !== 'number' || typeof progress.total_items !== 'number'
      || !(typeof progress.completed_at === 'string' || progress.completed_at === null)) throw new TypeError('Invalid provisional progress summary');
    return { enrollment, course, progress: progress as { completed_items: number; total_items: number; completed_at: string | null } };
  });
}

function listPath(query: CatalogListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.level) params.set('level', query.level);
  if (query.priceType) params.set('price_type', query.priceType);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  const search = params.toString();
  return search ? `courses?${search}` : 'courses';
}

export function createCatalogApi(http: HttpClient): CatalogApi {
  return {
    listCourses(query = {}, options = {}) {
      return http.request(listPath(query), {
        method: 'GET',
        headers: jsonHeaders,
        decoder: decodeCoursePage,
        signal: options.signal,
      });
    },
    async getCourse(courseId, options = {}) {
      if (typeof courseId !== 'string' || courseId.length === 0) throw new TypeError('courseId is required.');
      try {
        return await http.request(`courses/${encodeURIComponent(courseId)}`, {
          method: 'GET',
          headers: jsonHeaders,
          decoder: decodeCourseDetail,
          signal: options.signal,
        });
      } catch (error) {
        if (error instanceof HttpClientError && error.kind === 'http' && error.status === 404) return null;
        throw error;
      }
    },
    enrollFree(courseId) {
      if (!courseId) throw new TypeError('courseId is required.');
      return http.request(`courses/${encodeURIComponent(courseId)}/enroll`, {
        method: 'POST', headers: { ...jsonHeaders, 'content-type': 'application/json' }, decoder: decodeEnrollment,
      });
    },
    getMyEnrollments(options = {}) {
      return http.request('me/enrollments', { method: 'GET', headers: jsonHeaders, decoder: decodeEnrollmentPage, signal: options.signal });
    },
  };
}
