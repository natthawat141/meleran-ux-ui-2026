import { useCallback, useEffect, useRef, useState } from 'react';
import { devCatalogApi } from '../api/dev-catalog-client.ts';
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
  const [state, setState] = useState<DevCatalogListState>({ status: 'loading' });
  const generation = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const generationAtStart = ++generation.current;
    const controller = new AbortController();
    setState({ status: 'loading' });
    devCatalogApi.listCourses(listQuery(filter), { signal: controller.signal }).then(
      (page) => {
        if (generation.current !== generationAtStart) return;
        setState({
          status: 'ready',
          items: page.items,
          nextCursor: page.next_cursor,
          loadingMore: false,
          moreMessage: null,
        });
      },
      (error: unknown) => {
        if (generation.current !== generationAtStart) return;
        const message = catalogLoadErrorText(error);
        if (!message) return;
        setState({ status: 'error', message });
      },
    );
    return () => controller.abort();
  }, [filter.q, filter.category, reloadToken]);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'ready' || !current.nextCursor || current.loadingMore) return;
    const cursor = current.nextCursor;
    const generationAtStart = generation.current;
    setState({ ...current, loadingMore: true, moreMessage: null });
    devCatalogApi.listCourses(listQuery(filter, cursor)).then(
      (page) => {
        if (generation.current !== generationAtStart) return;
        setState((prev) => {
          if (prev.status !== 'ready') return prev;
          return {
            ...prev,
            items: [...prev.items, ...page.items],
            nextCursor: page.next_cursor,
            loadingMore: false,
            moreMessage: null,
          };
        });
      },
      (error: unknown) => {
        if (generation.current !== generationAtStart) return;
        const message = catalogLoadErrorText(error) ?? 'โหลดคอร์สเพิ่มไม่สำเร็จ';
        setState((prev) => (prev.status === 'ready' ? { ...prev, loadingMore: false, moreMessage: message } : prev));
      },
    );
  }, [filter]);

  return { state, loadMore };
}

export function useDevCatalogCategories(reloadToken: number): string[] {
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    devCatalogApi.listCourses({}, { signal: controller.signal }).then(
      (page) => {
        if (!controller.signal.aborted) setCategories([...new Set(page.items.map((item) => item.category))]);
      },
      (error: unknown) => {
        if (catalogLoadErrorText(error) === null) return;
        setCategories([]);
      },
    );
    return () => controller.abort();
  }, [reloadToken]);
  return categories;
}

export function useDevCatalogCourse(courseId: string, reloadToken: number): DevCatalogCourseState {
  const [state, setState] = useState<DevCatalogCourseState>({ status: 'loading' });
  useEffect(() => {
    if (!courseId) {
      setState({ status: 'missing' });
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading' });
    devCatalogApi.getCourse(courseId, { signal: controller.signal }).then(
      (course) => {
        if (!active) return;
        setState(course ? { status: 'ready', course } : { status: 'missing' });
      },
      (error: unknown) => {
        if (!active) return;
        const message = catalogLoadErrorText(error);
        if (message) setState({ status: 'error', message });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [courseId, reloadToken]);
  return state;
}

export function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
