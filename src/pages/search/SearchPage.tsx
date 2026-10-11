import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { centersToMarkers } from '@/components/map/markerData';
import type { MapViewHandle, MapViewState } from '@/components/map/types';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import type { GeoBounds, SearchFilters } from '@/data/types';
import { scrollIntoViewWithin } from '@/lib/scrollIntoViewWithin';
import { EMPTY_FILTERS, hasAnyFilter } from '@/state/searchState';
import { useCenterSearch } from '@/state/useCenterSearch';
import { useSearchState } from '@/state/useSearchState';
import { SearchDesktop } from './SearchDesktop';
import { SearchMobile } from './SearchMobile';

export interface SearchViewProps {
  filters: SearchFilters;
  setFilters: (next: SearchFilters | ((prev: SearchFilters) => SearchFilters)) => void;
  result: ReturnType<typeof useCenterSearch>;
  markers: ReturnType<typeof centersToMarkers>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  mapRef: React.RefObject<MapViewHandle | null>;
  initialView: { center: { lat: number; lng: number }; zoom: number } | null;
  onViewChange: (view: MapViewState, meta: { user: boolean }) => void;
  onSearchArea: (bounds: GeoBounds) => void;
  resetFilters: () => void;
  hasFilters: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  hrefFor: (c: { id: string }) => string;
}

/**
 * Search: list and map are two views of one state that lives in the URL.
 * This component owns that state; the two layouts are pure presentation.
 */
export function SearchPage() {
  const { filters, setFilters, selectedId, setSelectedId, camera, setCamera, scenario } = useSearchState();
  const result = useCenterSearch(filters, scenario);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();
  const mapRef = useRef<MapViewHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const initialCamera = useRef(camera);

  const markers = useMemo(
    () => centersToMarkers(result.items),
    [result.items, filters.categories],
  );

  /** Selecting from the map scrolls the matching card into view. */
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const card = listRef.current.querySelector<HTMLElement>(`[data-center-id="${selectedId}"]`);
    if (card) scrollIntoViewWithin(card);
  }, [selectedId, result.items]);

  const onViewChange = useCallback(
    (view: MapViewState, meta: { user: boolean }) => {
      if (meta.user) setCamera({ lat: view.center.lat, lng: view.center.lng, zoom: view.zoom });
    },
    [setCamera],
  );

  const onSearchArea = useCallback((bounds: GeoBounds) => setFilters((f) => ({ ...f, bounds })), [setFilters]);

  const view: SearchViewProps = {
    filters,
    setFilters,
    result,
    markers,
    selectedId,
    onSelect: setSelectedId,
    hoveredId,
    onHover: setHoveredId,
    mapRef,
    initialView: initialCamera.current ? { center: { lat: initialCamera.current.lat, lng: initialCamera.current.lng }, zoom: initialCamera.current.zoom } : null,
    onViewChange,
    onSearchArea,
    resetFilters: () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort }),
    hasFilters: hasAnyFilter(filters),
    listRef,
    hrefFor: (c) => `/centers/${c.id}`,
  };

  return isDesktop ? <SearchDesktop {...view} /> : <SearchMobile {...view} />;
}
