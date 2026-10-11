import { useRef, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { OptionRow } from '@/components/ui/OptionRow';
import { Popover } from '@/components/ui/Popover';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { SortKey } from '@/data/types';
import { SORT_LABEL, t } from '@/i18n';

const SORTS: SortKey[] = ['relevance', 'popular', 'center', 'name'];

export function SortMenu({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const list = (
    <div role="radiogroup" aria-label={t.results.sortLabel} style={{ padding: 2 }}>
      {SORTS.map((k) => (
        <OptionRow
          key={k}
          label={SORT_LABEL[k]}
          multi={false}
          selected={value === k}
          onSelect={() => {
            onChange(k);
            setOpen(false);
          }}
        />
      ))}
    </div>
  );

  return (
    <>
      <Chip ref={anchor} size="sm" dropdown open={open} icon={<ArrowUpDown size={14} />} onClick={() => setOpen((v) => !v)}>
        {SORT_LABEL[value]}
      </Chip>
      {open && !isMobile && (
        <Popover open onClose={() => setOpen(false)} anchorRef={anchor} align="end" label={t.results.sortLabel} minWidth={220}>
          {list}
        </Popover>
      )}
      {open && isMobile && (
        <Dialog open onClose={() => setOpen(false)} title={t.results.sortLabel}>
          {list}
        </Dialog>
      )}
    </>
  );
}
