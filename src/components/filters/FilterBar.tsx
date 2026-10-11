import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import type { SearchFilters } from '@/data/types';
import { t } from '@/i18n';
import { countActiveFacets, type FacetKey } from '@/state/searchState';
import { useAvailability } from '@/state/useCenterSearch';
import { FACETS } from './facets';
import { FacetControl } from './FacetControl';
import { FilterPanel } from './FilterPanel';
import s from './FilterBar.module.css';

interface Props {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  /** Floating above the map (Map page, mobile) */
  onMap?: boolean;
  /** Which facets get their own chip; the rest live in the panel */
  facetKeys?: FacetKey[] | 'primary' | 'none';
}

/** Compact filtering: chips for the main facets, everything else behind one button. */
export function FilterBar({ filters, onChange, onMap, facetKeys = 'primary' }: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const active = countActiveFacets(filters);
  const available = useAvailability();
  const facets = (
    facetKeys === 'none' ? [] : facetKeys === 'primary' ? FACETS.filter((f) => f.primary) : FACETS.filter((f) => facetKeys.includes(f.key))
  ).filter((f) => available.facet(f.key));

  return (
    <div className={s.bar}>
      <Chip
        icon={<SlidersHorizontal size={15} />}
        onMap={onMap}
        selected={active > 0}
        count={active || undefined}
        onClick={() => setPanelOpen(true)}
        aria-haspopup="dialog"
      >
        {t.filters.all}
      </Chip>
      {facets.length > 0 && <span className={s.divider} aria-hidden="true" />}
      <div className={s.scroller}>
        {facets.map((facet) => (
          <FacetControl key={facet.key} facet={facet} filters={filters} onChange={onChange} onMap={onMap} />
        ))}
      </div>
      <FilterPanel open={panelOpen} onClose={() => setPanelOpen(false)} filters={filters} onApply={onChange} />
    </div>
  );
}
