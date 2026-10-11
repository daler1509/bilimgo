import { useEffect, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { OptionRow } from '@/components/ui/OptionRow';
import type { SearchFilters } from '@/data/types';
import { countPlaces, fill, t } from '@/i18n';
import { countActiveFacets } from '@/state/searchState';
import { useAvailability, useCenterSearch, useFacetCounts } from '@/state/useCenterSearch';
import { FACETS, facetValues, setFacetValues, toggleFacetValue } from './facets';
import s from './FilterPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onApply: (next: SearchFilters) => void;
}

/**
 * Full filtering experience. Edits a draft and previews the result count
 * live, so applying is never a leap of faith.
 */
export function FilterPanel({ open, onClose, filters, onApply }: Props) {
  const [draft, setDraft] = useState(filters);
  const counts = useFacetCounts();
  const available = useAvailability();
  const preview = useCenterSearch(draft);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const active = countActiveFacets(draft);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.filters.title}
      description={t.filters.coverageNote}
      width={720}
      fullHeight
      footer={
        <div className={s.footer}>
          <Button variant="ghost" onClick={() => setDraft({ ...draft, categories: [], districts: [], formats: [], ages: [], features: [], bounds: null })} disabled={!active}>
            {t.filters.resetAll}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            loading={preview.status === 'loading'}
          >
            {preview.status === 'success' ? fill(t.filters.applyCount, { places: countPlaces(preview.total) }) : t.filters.apply}
          </Button>
        </div>
      }
    >
      {draft.bounds && (
        <div className={s.section}>
          <div className={s.areaRow}>
            <Crosshair size={16} aria-hidden="true" />
            <span style={{ flex: 1 }}>{t.filters.area}: {t.filters.areaSelected}</span>
            <Chip size="sm" onClick={() => setDraft({ ...draft, bounds: null })}>
              {t.map.clearArea}
            </Chip>
          </div>
        </div>
      )}

      {FACETS.filter((f) => available.facet(f.key)).map((facet) => {
        const selected = facetValues(draft, facet.key);
        const options = facet.options.filter(
          (o) => !facet.counts || !counts || (counts[facet.counts][o.value] ?? 0) > 0 || selected.includes(o.value),
        );
        const useRows = !!facet.counts;
        return (
          <section key={facet.key} className={s.section}>
            <div className={s.head}>
              <h3 className={s.title}>{facet.label}</h3>
              {facet.note ? <span className={s.note}>{facet.note}</span> : selected.length > 0 ? (
                <button type="button" className={s.note} onClick={() => setDraft(setFacetValues(draft, facet.key, []))}>
                  {t.filters.reset}
                </button>
              ) : null}
            </div>
            {useRows ? (
              <div className={s.grid}>
                {options.map((o) => (
                  <OptionRow
                    key={o.value}
                    label={o.label}
                    hint={o.hint}
                    glyph={o.glyph}
                    nested={o.nested}
                    className={o.hasChildren ? s.fullRow : undefined}
                    count={facet.counts ? counts?.[facet.counts][o.value] : undefined}
                    selected={selected.includes(o.value)}
                    onSelect={() => setDraft(toggleFacetValue(draft, facet.key, o.value))}
                  />
                ))}
              </div>
            ) : (
              <div className={s.chips}>
                {options.map((o) => (
                  <Chip
                    key={o.value}
                    selected={selected.includes(o.value)}
                    icon={o.glyph}
                    onClick={() => setDraft(toggleFacetValue(draft, facet.key, o.value))}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </Dialog>
  );
}
