import { useRef, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { OptionRow } from '@/components/ui/OptionRow';
import { Popover } from '@/components/ui/Popover';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { SearchFilters } from '@/data/types';
import { t } from '@/i18n';
import { useFacetCounts } from '@/state/useCenterSearch';
import { facetValues, setFacetValues, toggleFacetValue, type FacetConfig } from './facets';
import s from './FilterBar.module.css';

interface Props {
  facet: FacetConfig;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onMap?: boolean;
}

/** A filter chip plus its option list — popover on desktop, sheet on mobile. */
export function FacetControl({ facet, filters, onChange, onMap }: Props) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();
  const counts = useFacetCounts();
  const selected = facetValues(filters, facet.key);
  const selectedLabels = selected.map((v) => facet.options.find((o) => o.value === v)?.label ?? v);

  // only options that exist in the data (plus anything already selected)
  const options = facet.options.filter(
    (o) => !facet.counts || !counts || (counts[facet.counts][o.value] ?? 0) > 0 || selected.includes(o.value),
  );

  const list = (
    <div className={s.panelList} role="group" aria-label={facet.label}>
      {options.map((o) => (
        <OptionRow
          key={o.value}
          label={o.label}
          hint={o.hint}
          glyph={o.glyph}
          nested={o.nested}
          count={facet.counts ? counts?.[facet.counts][o.value] : undefined}
          selected={selected.includes(o.value)}
          onSelect={() => onChange(toggleFacetValue(filters, facet.key, o.value))}
        />
      ))}
    </div>
  );

  return (
    <>
      <Chip
        ref={anchor}
        dropdown
        open={open}
        onMap={onMap}
        selected={selected.length > 0}
        count={selected.length > 1 ? selected.length : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label={selected.length ? `${facet.label}: ${selectedLabels.join(', ')}` : facet.label}
      >
        {selected.length === 1 ? selectedLabels[0] : facet.label}
      </Chip>

      {open && !isMobile && (
        <Popover open onClose={() => setOpen(false)} anchorRef={anchor} label={facet.label} minWidth={facet.counts ? 320 : 260}>
          {list}
        </Popover>
      )}

      {open && isMobile && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={facet.label}
          description={facet.note}
          footer={
            <>
              <button type="button" className={s.reset} onClick={() => onChange(setFacetValues(filters, facet.key, []))}>
                {t.common.reset}
              </button>
              <Chip selected onClick={() => setOpen(false)} style={{ marginLeft: 'auto' }}>
                {t.common.done}
              </Chip>
            </>
          }
        >
          {list}
        </Dialog>
      )}
    </>
  );
}
