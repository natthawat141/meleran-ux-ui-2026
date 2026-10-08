// PROVISIONAL MOCK — development and tests only.
//
// A fetch-compatible function that answers the two candidate read endpoints from the R4a Flow B draft
// (`GET courses`, `GET courses/{id}`). It is meant to be injected as the `fetcher` of createHttpClient from
// @melearn/api-client; it is not a server, does not persist anything and proves nothing about a real Backend.
//
// Rules this mock enforces so Frontend code cannot grow to depend on behaviour nobody has agreed to:
// - It refuses to be created outside the `development` and `test` environments.
// - Only `published` records are visible; every field is copied from an explicit allow-list.
// - Anything the draft does not specify (sort, slug lookup, extra query names) is rejected rather than guessed.
// - Mock-only assumptions are listed in docs/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md and need Backend answers.

import { provisionalCatalogRecords } from './catalog-fixtures.ts';
import type { MockCourseRecord } from './catalog-fixtures.ts';
import type { ProvisionalCourseDetail, ProvisionalCourseSummary } from '../catalog-provisional-contract.ts';

export type ProvisionalMockEnvironment = 'development' | 'test';

export interface ProvisionalCatalogFetcherOptions {
  /** Pass the real environment name; anything other than `development` or `test` throws. */
  environment: string | undefined;
  /** Path prefix the HTTP client was configured with, for example `/mock-api/v1`. */
  basePath: string;
  records?: readonly MockCourseRecord[];
}

const allowedEnvironments: readonly string[] = ['development', 'test'];
const listParams: readonly string[] = ['q', 'category', 'level', 'price_type', 'limit', 'cursor'];
const defaultLimit = 20;
const maxLimit = 50;
// Parsing-only origin; never used to reach a network.
const parsingOrigin = 'https://provisional-mock.invalid';

interface FieldError { field: string; code: string }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-melearn-mock': 'provisional-catalog' },
  });
}

function toSummary(record: MockCourseRecord): ProvisionalCourseSummary {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    subtitle: record.subtitle,
    cover_url: record.cover_url,
    category: record.category,
    level: record.level,
    price: record.price ? { amount_minor: record.price.amount_minor, currency: record.price.currency } : null,
    instructor: {
      id: record.instructor.id,
      display_name: record.instructor.display_name,
      avatar_url: record.instructor.avatar_url,
    },
    published_at: record.published_at as string,
  };
}

function toDetail(record: MockCourseRecord): ProvisionalCourseDetail {
  return {
    ...toSummary(record),
    description: record.description,
    outcomes: [...record.outcomes],
    outline: record.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      items: chapter.items.map((item) => ({ id: item.id, type: item.type, title: item.title })),
    })),
  };
}

export function createProvisionalCatalogFetcher(options: ProvisionalCatalogFetcherOptions): typeof fetch {
  if (typeof options.environment !== 'string' || !allowedEnvironments.includes(options.environment)) {
    throw new Error('The provisional catalog mock can only be created in the development or test environment.');
  }
  const prefix = options.basePath.replace(/\/+$/, '');
  const records = options.records ?? provisionalCatalogRecords;
  let requestCounter = 0;

  const errorResponse = (status: number, code: string, message: string, fields?: FieldError[]) => {
    requestCounter += 1;
    return jsonResponse(status, {
      error: {
        code,
        message,
        request_id: `mock-request-${requestCounter}`,
        ...(fields ? { details: { fields } } : {}),
      },
    });
  };
  const notFound = () => errorResponse(404, 'not_found', 'ไม่พบข้อมูลที่ขอ');
  const published = () => records.filter((record) => record.status === 'published' && record.published_at !== null);

  const listCourses = (params: URLSearchParams): Response => {
    const problems: FieldError[] = [];
    for (const name of new Set(params.keys())) {
      if (!listParams.includes(name)) problems.push({ field: name, code: 'unsupported' });
      else if (params.getAll(name).length > 1) problems.push({ field: name, code: 'duplicate' });
    }

    let limit = defaultLimit;
    const limitText = params.get('limit');
    if (limitText !== null) {
      limit = /^\d{1,4}$/.test(limitText) ? Number(limitText) : 0;
      if (limit < 1 || limit > maxLimit) problems.push({ field: 'limit', code: 'out_of_range' });
    }

    let offset = 0;
    const cursor = params.get('cursor');
    if (cursor !== null) {
      const match = /^o:(\d{1,6})$/.exec(cursor);
      if (match) offset = Number(match[1]);
      else problems.push({ field: 'cursor', code: 'invalid' });
    }

    const priceType = params.get('price_type');
    if (priceType !== null && priceType !== 'free' && priceType !== 'paid') {
      problems.push({ field: 'price_type', code: 'invalid' });
    }

    if (problems.length) return errorResponse(422, 'validation_failed', 'ข้อมูลที่ส่งไม่ถูกต้อง', problems);

    const q = params.get('q')?.trim().toLowerCase() ?? '';
    const category = params.get('category');
    const level = params.get('level');
    const matches = published()
      .filter((record) => !q || `${record.title} ${record.subtitle ?? ''}`.toLowerCase().includes(q))
      .filter((record) => category === null || record.category === category)
      .filter((record) => level === null || record.level === level)
      .filter((record) => priceType === null || (priceType === 'free') === (record.price === null))
      .sort((a, b) => (b.published_at as string).localeCompare(a.published_at as string) || a.id.localeCompare(b.id));

    const nextOffset = offset + limit;
    return jsonResponse(200, {
      items: matches.slice(offset, nextOffset).map(toSummary),
      next_cursor: nextOffset < matches.length ? `o:${nextOffset}` : null,
    });
  };

  const getCourse = (courseId: string): Response => {
    const record = published().find((candidate) => candidate.id === courseId);
    return record ? jsonResponse(200, toDetail(record)) : notFound();
  };

  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') throw new Error('The provisional catalog mock supports GET requests only.');
    const signal = init?.signal ?? request?.signal;
    if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');

    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, parsingOrigin);
    if (prefix && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return notFound();
    const route = url.pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '').split('/');

    if (route.length === 1 && route[0] === 'courses') return listCourses(url.searchParams);
    if (route.length === 2 && route[0] === 'courses') {
      let courseId: string;
      try {
        courseId = decodeURIComponent(route[1]);
      } catch {
        return notFound();
      }
      return getCourse(courseId);
    }
    return notFound();
  };

  return fetcher as typeof fetch;
}
