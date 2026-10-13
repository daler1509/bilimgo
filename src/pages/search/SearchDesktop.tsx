import { VerifiedBadge } from '@/components/centers/CenterBadges';
import { CenterList } from '@/components/centers/CenterList';
import { ActiveFilters } from '@/components/filters/ActiveFilters';
import { FilterBar } from '@/components/filters/FilterBar';
import { SortMenu } from '@/components/filters/SortMenu';
import { MapView } from '@/components/map/MapView';
import { CompactSearch } from '@/components/search/CompactSearch';
import { countPlaces, t } from '@/i18n';
import { CorrectedQuery } from './CorrectedQuery';
import type { SearchViewProps } from './SearchPage';
import s from './search.module.css';

/** Desktop: results and map side by side, hover and selection synchronised. */
export function SearchDesktop(p: SearchViewProps) {
  return (
    <div className={s.split}>
      <h1 className="sr-only">{t.results.heading}</h1>
      <section className={s.panel} aria-label={t.results.label}>
        <div className={s.panelTop}>
          <CompactSearch filters={p.filters} onChange={p.setFilters} />
          <FilterBar filters={p.filters} onChange={p.setFilters} />
        </div>

        <div className={s.resultsHead}>
          <div className={s.count}>
            <span className={s.countValue}>
              {p.result.status === 'success' ? countPlaces(p.result.total) : '—'}
            </span>
            <VerifiedBadge />
          </div>
          <SortMenu value={p.filters.sort} onChange={(sort) => p.setFilters({ ...p.filters, sort })} />
        </div>

        <div className={s.tagsRow}>
          {p.result.correctedQuery && (
            <CorrectedQuery query={p.result.correctedQuery} onApply={() => p.setFilters({ ...p.filters, q: p.result.correctedQuery! })} />
          )}
          <ActiveFilters filters={p.filters} onChange={p.setFilters} />
        </div>

        <div className={s.results} ref={p.listRef}>
          <CenterList
            result={p.result}
            selectedId={p.selectedId}
            hoveredId={p.hoveredId}
            onSelect={(id) => p.onSelect(id === p.selectedId ? null : id)}
            onHover={p.onHover}
            onResetFilters={p.resetFilters}
            hasFilters={p.hasFilters}
            hrefFor={p.hrefFor}
          />
        </div>
      </section>

      <div className={s.mapWrap}>
        <MapView
          ref={p.mapRef}
          markers={p.markers}
          selectedId={p.selectedId}
          hoveredId={p.hoveredId}
          onMarkerClick={(id) => p.onSelect(id === p.selectedId ? null : id)}
          onMarkerHover={p.onHover}
          onBackgroundClick={() => p.onSelect(null)}
          onViewChange={p.onViewChange}
          onSearchArea={p.onSearchArea}
          initialView={p.initialView}
          ariaLabel={t.results.mapLabel}
        />
      </div>
    </div>
  );
}
