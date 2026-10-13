import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { List } from 'lucide-react';
import { VerifiedBadge } from '@/components/centers/CenterBadges';
import { CenterPreviewCard } from '@/components/centers/CenterPreviewCard';
import { FilterBar } from '@/components/filters/FilterBar';
import { useNavTarget } from '@/components/layout/navItems';
import { MapView } from '@/components/map/MapView';
import { centersToMarkers } from '@/components/map/markerData';
import type { MapViewHandle, MapViewState } from '@/components/map/types';
import { CompactSearch, SearchSummaryPill } from '@/components/search/CompactSearch';
import { SearchBar } from '@/components/search/SearchBar';
import { draftFromFilters, draftToFilters, type SearchDraft } from '@/components/search/searchDraft';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { CATEGORY_BY_ID } from '@/data/categories';
import type { CategoryId, GeoBounds } from '@/data/types';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { countPlaces, t } from '@/i18n';
import { EMPTY_FILTERS } from '@/state/searchState';
import { useAvailability, useCenterSearch, useSupportedIntents } from '@/state/useCenterSearch';
import { useSearchState } from '@/state/useSearchState';
import { PreviewSheet } from './PreviewSheet';
import s from './map.module.css';

/**
 * Map-first exploration of the city. The same URL state as Search, so the
 * user can switch views without losing anything.
 */
export function MapPage() {
  const { filters, setFilters, selectedId, setSelectedId, camera, setCamera, scenario } = useSearchState();
  const isDesktop = useIsDesktop();
  const mapRef = useRef<MapViewHandle>(null);
  const initialCamera = useRef(camera);
  const target = useNavTarget();
  const supported = useSupportedIntents();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SearchDraft>(() => draftFromFilters(filters));

  // everything matching the filters, plus the rest of the city as context
  const matching = useCenterSearch(filters, scenario);
  const all = useCenterSearch(EMPTY_FILTERS, scenario === 'error' ? 'ok' : scenario);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { topCategories } = useAvailability();

  const markers = useMemo(() => {
    const matchedIds = new Set(matching.items.map((c) => c.id));
    const mutedIds = new Set(all.items.filter((c) => !matchedIds.has(c.id)).map((c) => c.id));
    return centersToMarkers(all.items, { mutedIds });
  }, [all.items, matching.items, filters.categories]);

  const selected = matching.items.find((c) => c.id === selectedId) ?? all.items.find((c) => c.id === selectedId) ?? null;
  const activeCategory = filters.categories.length === 1 ? filters.categories[0]! : null;
  const total = matching.status === 'success' ? matching.total : null;

  const onViewChange = useCallback(
    (view: MapViewState, meta: { user: boolean }) => {
      if (meta.user) setCamera({ lat: view.center.lat, lng: view.center.lng, zoom: view.zoom });
    },
    [setCamera],
  );

  const onSearchArea = useCallback((bounds: GeoBounds) => setFilters((f) => ({ ...f, bounds })), [setFilters]);

  const toggleCategory = (id: CategoryId) =>
    setFilters((f) => ({ ...f, categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [id] }));

  const openEditor = () => {
    setDraft(draftFromFilters(filters));
    setEditing(true);
  };

  // desktop: the card opens at the marker; phones get PreviewSheet below
  const preview = selected && isDesktop ? (
    <CenterPreviewCard center={selected} detailsHref={`/centers/${selected.id}`} onClose={() => setSelectedId(null)} />
  ) : null;

  return (
    <div className={s.root}>
      <h1 className="sr-only">{t.map.heading}</h1>
      <MapView
        ref={mapRef}
        markers={markers}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onMarkerClick={setSelectedId}
        onMarkerHover={setHoveredId}
        onBackgroundClick={() => setSelectedId(null)}
        onViewChange={onViewChange}
        onSearchArea={onSearchArea}
        initialView={initialCamera.current ? { center: { lat: initialCamera.current.lat, lng: initialCamera.current.lng }, zoom: initialCamera.current.zoom } : null}
        insets={{ top: isDesktop ? 108 : 104, bottom: isDesktop ? 64 : selected ? 240 : 72 }}
        popup={isDesktop && selected ? { id: selected.id, content: preview } : null}
        ariaLabel={t.map.pageLabel}
      >
        <div className={s.controls}>
          <div className={s.searchRow}>
            {isDesktop ? <CompactSearch filters={filters} onChange={setFilters} /> : <SearchSummaryPill filters={filters} onOpen={openEditor} />}
          </div>
          <div className={s.chipRow}>
            <FilterBar filters={filters} onChange={setFilters} onMap facetKeys={isDesktop ? 'none' : 'primary'} />
            {isDesktop &&
              // the chosen direction stays first and visibly on, so it can be switched off in place
              [...filters.categories, ...topCategories.map((c) => c.id).filter((id) => id !== 'languages' && !filters.categories.includes(id))].map((id) => (
                <Chip key={id} size="sm" onMap selected={filters.categories.includes(id)} onClick={() => toggleCategory(id)}>
                  {CATEGORY_BY_ID[id].label}
                </Chip>
              ))}
          </div>
        </div>

        {isDesktop ? (
          <div className={s.statusBar} role="status">
            <span className={s.statusDot} aria-hidden="true" />
            <span>{total === null ? '—' : countPlaces(total)}</span>
            {activeCategory && <span className={s.statusPart}>{CATEGORY_BY_ID[activeCategory].label}</span>}
            <VerifiedBadge className={s.statusBadge} />
          </div>
        ) : !selected ? (
          <Link to={target('/search')} className={s.viewSwitch}>
            <List size={17} aria-hidden="true" />
            {t.results.toList}
            {total !== null && (
              <span className={s.viewCount} aria-label={countPlaces(total)}>
                {total}
              </span>
            )}
          </Link>
        ) : null}
        {!isDesktop && <PreviewSheet center={selected} onClose={() => setSelectedId(null)} />}
      </MapView>

      {!isDesktop && (
        <Dialog open={editing} onClose={() => setEditing(false)} title={t.search.editSearch}>
          <SearchBar
            draft={draft}
            onChange={setDraft}
            layout="stacked"
            onSubmit={() => {
              setFilters(draftToFilters(draft, filters, supported));
              setEditing(false);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
