import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Center, SearchFilters } from '@/data/types';
import { CATEGORIES } from '@/data/categories';
import { DISTRICTS } from '@/data/districts';
import { centersRepository, isFacetAvailable, onCentersInvalidated, type FacetCounts, type MockScenario } from '@/services/centersRepository';
import type { FacetKey } from './searchState';

export type SearchStatus = 'loading' | 'success' | 'error';

export interface SearchResult {
  status: SearchStatus;
  items: Center[];
  total: number;
  /** true while a new request runs and previous results are still shown */
  isRefreshing: boolean;
  /** Set when results come from the query in the other keyboard layout */
  correctedQuery?: string;
  retry: () => void;
}

/**
 * Last answers per query. Coming back to a list (browser back from a profile)
 * renders it at full length on the first frame, so the scroll position can be
 * restored; the request still runs and replaces it if anything changed.
 */
type Answer = { items: Center[]; total: number; correctedQuery?: string };
const answers = new Map<string, Answer>();
const ANSWERS_KEPT = 24;
onCentersInvalidated(() => answers.clear());

function remember(key: string, answer: Answer) {
  answers.delete(key);
  answers.set(key, answer);
  if (answers.size > ANSWERS_KEPT) answers.delete(answers.keys().next().value!);
}

/**
 * Fetches results for the given filters. Keeps previous results visible
 * during refetch (no skeleton flash on every filter tap) and aborts stale
 * requests so fast filter changes never show out-of-order data.
 */
export function useCenterSearch(filters: SearchFilters, scenario: MockScenario = 'ok'): SearchResult {
  const key = JSON.stringify(filters);
  const cacheKey = `${scenario}:${key}`;
  const [state, setState] = useState<{ status: SearchStatus; items: Center[]; total: number; hasData: boolean; correctedQuery?: string }>(() => {
    const known = answers.get(cacheKey);
    return known ? { status: 'success', ...known, hasData: true } : { status: 'loading', items: [], total: 0, hasData: false };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    centersRepository
      .search(JSON.parse(key) as SearchFilters, { signal: ctrl.signal, scenario })
      .then((res) => {
        remember(`${scenario}:${key}`, { items: res.items, total: res.total, correctedQuery: res.correctedQuery });
        setState({ status: 'success', items: res.items, total: res.total, hasData: true, correctedQuery: res.correctedQuery });
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setState((s) => ({ ...s, status: 'error' }));
      });
    return () => ctrl.abort();
  }, [key, scenario, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    status: state.status === 'loading' && state.hasData ? 'success' : state.status,
    items: state.items,
    total: state.total,
    isRefreshing: state.status === 'loading' && state.hasData,
    correctedQuery: state.correctedQuery,
    retry,
  };
}

/** Facet counts for discovery cards — resolved once and cached until the catalogue changes. */
let countsCache: FacetCounts | null = null;
onCentersInvalidated(() => {
  countsCache = null;
});

export function useFacetCounts() {
  const [counts, setCounts] = useState(countsCache);
  useEffect(() => {
    if (countsCache) return;
    let alive = true;
    let timer = 0;
    // the catalogue may be unreachable for a moment — keep trying quietly, backing off
    const load = (delay: number) => {
      centersRepository
        .counts()
        .then((c) => {
          countsCache = c;
          if (alive) setCounts(c);
        })
        .catch(() => {
          if (alive) timer = window.setTimeout(() => load(Math.min(delay * 2, 30000)), delay);
        });
    };
    load(2000);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);
  return counts;
}

/**
 * What the current data can actually answer: filters, directions and areas
 * without data are hidden instead of offered and silently returning nothing.
 */
export function useAvailability() {
  const counts = useFacetCounts();
  return useMemo(() => {
    const byCount = (n?: number) => (n ?? 0) > 0;
    return {
      counts,
      ready: !!counts,
      facet: (key: FacetKey) => isFacetAvailable(counts, key),
      categories: counts ? CATEGORIES.filter((c) => byCount(counts.categories[c.id])) : [],
      /** Directions ordered by how many places teach them */
      topCategories: counts
        ? [...CATEGORIES].filter((c) => byCount(counts.categories[c.id])).sort((a, b) => counts.categories[b.id]! - counts.categories[a.id]!)
        : [],
      districts: counts ? DISTRICTS.filter((d) => byCount(counts.districts[d.id])) : [],
    };
  }, [counts]);
}

export type Availability = ReturnType<typeof useAvailability>;

/** Which parsed intents may become filters (see draftToFilters) */
export function useSupportedIntents() {
  const available = useAvailability();
  return useMemo(() => ({ ages: available.facet('ages'), formats: available.facet('formats') }), [available]);
}
export type { FacetCounts };

export function useCentersByIds(ids: string[]) {
  const [items, setItems] = useState<Center[] | null>(null);
  const key = ids.join(',');
  useEffect(() => {
    const ctrl = new AbortController();
    centersRepository
      .getByIds(key ? key.split(',') : [], { signal: ctrl.signal })
      .then(setItems)
      .catch(() => {});
    return () => ctrl.abort();
  }, [key]);
  return items;
}
