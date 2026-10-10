import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { devCatalogApi } from '../api/dev-catalog-client.ts';
import { getCourseByRouteKey } from '../api/catalog-api.ts';
import { catalogLoadErrorText } from '../api/catalog-display.ts';
import type { CatalogListQuery } from '../api/catalog-api.ts';
import type { ProvisionalCourseDetail, ProvisionalCourseSummary } from '../api/catalog-provisional-contract.ts';

export interface DevCatalogFilter {
  q: string;
  category: string;
}

export type DevCatalogListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
    status: 'ready';
    items: ProvisionalCourseSummary[];
    nextCursor: string | null;
    loadingMore: boolean;
    moreMessage: string | null;
  };

export type DevCatalogCourseState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'missing' }
  | { status: 'ready'; course: ProvisionalCourseDetail };

function listQuery(filter: DevCatalogFilter, cursor?: string): CatalogListQuery {
  const q = filter.q.trim();
  return {
    ...(q ? { q } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

export function useDevCatalogList(filter: DevCatalogFilter, reloadToken: number) {
  const query = useInfiniteQuery({
    queryKey: ['catalog', 'public', filter.q, filter.category, reloadToken],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => devCatalogApi.listCourses(listQuery(filter, pageParam), { signal }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const pages = query.data?.pages ?? [];
  const nextCursor = pages.at(-1)?.next_cursor ?? null;
  const state: DevCatalogListState = query.isPending
    ? { status: 'loading' }
    : !query.data && query.isError
      ? { status: 'error', message: catalogLoadErrorText(query.error) ?? 'โหลดคอร์สไม่สำเร็จ' }
      : { status: 'ready', items: pages.flatMap((page) => page.items), nextCursor,
          loadingMore: query.isFetchingNextPage, moreMessage: query.isFetchNextPageError ? catalogLoadErrorText(query.error) ?? 'โหลดคอร์สเพิ่มไม่สำเร็จ' : null };
  return { state, loadMore: () => { if (nextCursor && !query.isFetchingNextPage) void query.fetchNextPage(); }, reload: query.refetch };
}

export function useDevCatalogCategories(reloadToken: number): string[] {
  const query = useQuery({ queryKey: ['catalog', 'categories', reloadToken], queryFn: async ({ signal }) => {
    const page = await devCatalogApi.listCourses({}, { signal });
    return [...new Set(page.items.map((item) => item.category))];
  } });
  return query.data ?? [];
}

export function useDevCatalogCourse(courseId: string, reloadToken: number): DevCatalogCourseState {
  const query = useQuery({ queryKey: ['catalog', 'detail', courseId, reloadToken], queryFn: ({ signal }) => getCourseByRouteKey(devCatalogApi, courseId, { signal }), enabled: Boolean(courseId) });
  if (!courseId || query.data === null) return { status: 'missing' };
  if (query.isPending) return { status: 'loading' };
  if (query.isError) return { status: 'error', message: catalogLoadErrorText(query.error) ?? 'โหลดคอร์สไม่สำเร็จ' };
  return query.data ? { status: 'ready', course: query.data } : { status: 'missing' };
}

export function useDevMyEnrollments(enabled: boolean) {
  return useQuery({ queryKey: ['enrollments', 'mine'], queryFn: ({ signal }) => devCatalogApi.getMyEnrollments({ signal }), enabled });
}

export function useDevEnrollFree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => devCatalogApi.enrollFree(courseId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['enrollments', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['learning'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
    },
  });
}

export function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delayMs); return () => clearTimeout(timer); }, [value, delayMs]);
  return debounced;
}
