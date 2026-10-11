import { Crosshair } from 'lucide-react';
import { Tag } from '@/components/ui/Chip';
import type { SearchFilters } from '@/data/types';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { EMPTY_FILTERS, FACET_KEYS, countActiveFacets } from '@/state/searchState';
import { facetOptionLabel, facetValues, toggleFacetValue } from './facets';
import s from './FilterBar.module.css';

interface Props {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  scroll?: boolean;
}

/** Everything currently narrowing the results — each removable in one tap. */
export function ActiveFilters({ filters, onChange, scroll }: Props) {
  const active = countActiveFacets(filters);
  if (!active && !filters.q) return null;

  return (
    <div className={cn(scroll ? s.tagsScroll : s.tags)} aria-label={t.filters.active} role="group">
      {filters.q && (
        <Tag removeLabel={t.filters.remove} onRemove={() => onChange({ ...filters, q: '' })}>
          «{filters.q}»
        </Tag>
      )}
      {FACET_KEYS.flatMap((key) =>
        facetValues(filters, key).map((value) => (
          <Tag key={`${key}:${value}`} removeLabel={t.filters.remove} onRemove={() => onChange(toggleFacetValue(filters, key, value))}>
            {facetOptionLabel(key, value)}
          </Tag>
        )),
      )}
      {filters.bounds && (
        <Tag removeLabel={t.filters.remove} onRemove={() => onChange({ ...filters, bounds: null })}>
          <Crosshair size={12} style={{ marginRight: 4, verticalAlign: -1 }} aria-hidden="true" />
          {t.filters.area}
        </Tag>
      )}
      <button type="button" className={s.reset} onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}>
        {t.filters.resetAll}
      </button>
    </div>
  );
}
