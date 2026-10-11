import { useState } from 'react';
import { Link } from 'react-router';
import { Map as MapIcon } from 'lucide-react';
import { CenterList } from '@/components/centers/CenterList';
import { ActiveFilters } from '@/components/filters/ActiveFilters';
import { FilterBar } from '@/components/filters/FilterBar';
import { SortMenu } from '@/components/filters/SortMenu';
import { useNavTarget } from '@/components/layout/navItems';
import { SearchSummaryPill } from '@/components/search/CompactSearch';
import { SearchBar } from '@/components/search/SearchBar';
import { draftFromFilters, draftToFilters, type SearchDraft } from '@/components/search/searchDraft';
import { Dialog } from '@/components/ui/Dialog';
import { countPlaces, t } from '@/i18n';
import { useSupportedIntents } from '@/state/useCenterSearch';
import { CorrectedQuery } from './CorrectedQuery';
import type { SearchViewProps } from './SearchPage';
import s from './search.module.css';

/**
 * Phones & tablets: search is the list. It scrolls as a page, so coming back
 * from a profile lands on the same card; the map is one tap away with the
 * same filters (and the map has the way back to this list).
 */
export function SearchMobile(p: SearchViewProps) {
  const [editing, setEditing] = useState(false);
  const supported = useSupportedIntents();
  const [draft, setDraft] = useState<SearchDraft>(() => draftFromFilters(p.filters));
  const target = useNavTarget();

  const openEditor = () => {
    setDraft(draftFromFilters(p.filters));
    setEditing(true);
  };

  return (
    <div className={s.mobile}>
      <h1 className="sr-only">{t.results.heading}</h1>

      <div className={s.mobileTop}>
        <SearchSummaryPill filters={p.filters} onOpen={openEditor} />
        <FilterBar filters={p.filters} onChange={p.setFilters} />
      </div>

      <section className={s.mobileResults} aria-label={t.results.label}>
        <div className={s.mobileHead}>
          <span className={s.countValue}>{p.result.status === 'success' ? countPlaces(p.result.total) : '—'}</span>
          <SortMenu value={p.filters.sort} onChange={(sort) => p.setFilters({ ...p.filters, sort })} />
        </div>
        {p.result.correctedQuery && (
          <CorrectedQuery query={p.result.correctedQuery} onApply={() => p.setFilters({ ...p.filters, q: p.result.correctedQuery! })} />
        )}
        <ActiveFilters filters={p.filters} onChange={p.setFilters} scroll />
        <div ref={p.listRef} className={s.mobileList}>
          <CenterList
            result={p.result}
            primaryAction="link"
            onResetFilters={p.resetFilters}
            hasFilters={p.hasFilters}
            hrefFor={p.hrefFor}
            compact
            skeletonCount={4}
          />
        </div>
        <p className={s.mobileNote}>{t.data.notice}</p>
      </section>

      <Link to={target('/map')} className={s.viewSwitch}>
        <MapIcon size={17} aria-hidden="true" />
        {t.results.toMap}
      </Link>

      <Dialog open={editing} onClose={() => setEditing(false)} title={t.search.editSearch}>
        <SearchBar
          draft={draft}
          onChange={setDraft}
          layout="stacked"
          onSubmit={() => {
            p.setFilters(draftToFilters(draft, p.filters, supported));
            setEditing(false);
          }}
        />
      </Dialog>
    </div>
  );
}
