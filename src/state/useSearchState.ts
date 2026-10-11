import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { SearchFilters } from '@/data/types';
import type { MockScenario } from '@/services/centersRepository';
import {
  cameraFromParams,
  cameraToParam,
  filtersFromParams,
  writeFilters,
  type CameraParam,
} from './searchState';

/**
 * URL-backed search state shared by Search and Map pages.
 * Filter changes push history entries (back button undoes a filter);
 * selection and camera updates replace, so history isn't flooded.
 */
export function useSearchState() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => filtersFromParams(params), [params]);
  const selectedId = params.get('sel');
  const camera = useMemo(() => cameraFromParams(params), [params]);
  const scenario = (params.get('mock') as MockScenario | null) ?? 'ok';

  const setFilters = useCallback(
    (next: SearchFilters | ((prev: SearchFilters) => SearchFilters)) => {
      setParams(
        (prev) => {
          const current = filtersFromParams(prev);
          const value = typeof next === 'function' ? next(current) : next;
          const p = writeFilters(prev, value);
          // a new result set invalidates the selection
          p.delete('sel');
          return p;
        },
        { preventScrollReset: true },
      );
    },
    [setParams],
  );

  const patchFilters = useCallback(
    (patch: Partial<SearchFilters>) => setFilters((f) => ({ ...f, ...patch })),
    [setFilters],
  );

  const setSelectedId = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (id) p.set('sel', id);
          else p.delete('sel');
          return p;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );

  const setCamera = useCallback(
    (c: CameraParam) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('v', cameraToParam(c));
          return p;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );

  return { filters, setFilters, patchFilters, selectedId, setSelectedId, camera, setCamera, scenario, params };
}
