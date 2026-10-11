import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronRight, MapPin, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Popover } from '@/components/ui/Popover';
import { CATEGORY_BY_ID } from '@/data/categories';
import { DISTRICT_BY_ID } from '@/data/districts';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { AGE_LABEL, FORMAT_LABEL, t } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAvailability } from '@/state/useCenterSearch';
import type { SearchDraft } from './searchDraft';
import { WhatPanel, WherePanel, WhoPanel } from './SearchPanels';
import s from './SearchBar.module.css';

type SegmentId = 'what' | 'where' | 'who';

interface Props {
  draft: SearchDraft;
  onChange: (draft: SearchDraft) => void;
  onSubmit: () => void;
  /** 'hero' — 3 columns on desktop; 'stacked' — one column (phones, sheets) */
  layout?: 'auto' | 'stacked';
  autoFocus?: boolean;
  id?: string;
}

const PANELS: Record<SegmentId, typeof WhatPanel> = { what: WhatPanel, where: WherePanel, who: WhoPanel };
const panelTitle = (id: SegmentId) => ({ what: t.search.what, where: t.search.where, who: t.search.who })[id];

/**
 * The product's primary control. One component, three segments, the same
 * panels on desktop (popover) and mobile (sheet) — so behaviour can't drift
 * between breakpoints.
 *
 * On desktop «what» is an inline text field that opens its popover on focus.
 * In a sheet it is a button like the others: a modal sheet returns focus to
 * whatever opened it, and a field that opens on focus would reopen the sheet
 * the moment it closes. Typing then happens in a field inside the sheet.
 */
export function SearchBar({ draft, onChange, onSubmit, layout = 'auto', autoFocus, id }: Props) {
  const isMobile = useIsMobile();
  const stacked = layout === 'stacked' || isMobile;
  const available = useAvailability();
  // «Для кого» appears once centres publish ages or formats
  const showWho = available.facet('ages') || available.facet('formats');
  const [open, setOpen] = useState<SegmentId | null>(null);
  const refs = {
    what: useRef<HTMLDivElement>(null),
    where: useRef<HTMLButtonElement>(null),
    who: useRef<HTMLButtonElement>(null),
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholder, setPlaceholder] = useState<string>(t.search.whatExamples[0]!);

  // gently cycle example queries while the field is empty and untouched
  useEffect(() => {
    if (draft.text || open === 'what') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % t.search.whatExamples.length;
      setPlaceholder(t.search.whatExamples[i]!);
    }, 3600);
    return () => window.clearInterval(id);
  }, [draft.text, open]);

  const patch = (p: Partial<SearchDraft>) => onChange({ ...draft, ...p });

  const whatValue = draft.categories.length
    ? draft.categories.map((c) => CATEGORY_BY_ID[c].label).join(', ')
    : '';
  const whereValue = draft.districts.length
    ? draft.districts.map((d) => DISTRICT_BY_ID[d].label).join(', ')
    : '';
  const whoValue = useMemo(() => {
    const parts = [...draft.ages.map((a) => AGE_LABEL[a]), ...draft.formats.map((f) => FORMAT_LABEL[f])];
    return parts.join(', ');
  }, [draft.ages, draft.formats]);

  const openSeg = open;
  const Panel = openSeg ? PANELS[openSeg] : null;
  const submit = () => {
    setOpen(null);
    onSubmit();
  };
  const panelProps = { draft, onChange: patch, onDone: () => setOpen(null), onSubmit: submit };

  const segment = (seg: SegmentId, label: string, icon: ReactNode, value: string, placeholderText: string, children?: ReactNode) => (
    <button
      type="button"
      ref={refs[seg] as RefObject<HTMLButtonElement | null>}
      className={cn(s.segment, open === seg && s.open)}
      aria-expanded={open === seg}
      aria-haspopup="dialog"
      onClick={() => setOpen(open === seg ? null : seg)}
    >
      <span className={s.label}>
        {icon}
        {label}
      </span>
      <span className={s.stackedValueRow}>
        <span className={cn(s.value, !value && s.placeholder)}>{value || placeholderText}</span>
        {stacked && <ChevronRight size={16} className={s.chevron} aria-hidden="true" />}
      </span>
      {children}
    </button>
  );

  return (
    <>
      <div className={cn(s.bar, stacked && s.stacked, !showWho && s.twoSegments)} id={id} role="search">
        {stacked ? (
          segment('what', t.search.what, <Search size={13} aria-hidden="true" />, draft.text || whatValue, placeholder)
        ) : (
          // on desktop "what" is a real text field so typing works immediately
          <div ref={refs.what} className={cn(s.segment, open === 'what' && s.open)} onClick={() => inputRef.current?.focus()}>
            <span className={s.label}>
              <Search size={13} aria-hidden="true" />
              {t.search.what}
            </span>
            <input
              ref={inputRef}
              className={s.input}
              value={draft.text || whatValue}
              placeholder={placeholder}
              autoFocus={autoFocus}
              aria-label={t.search.what}
              onFocus={() => setOpen('what')}
              onChange={(e) => patch({ text: e.target.value, categories: [] })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') setOpen(null);
              }}
            />
          </div>
        )}

        {segment('where', t.search.where, <MapPin size={13} aria-hidden="true" />, whereValue, t.search.wherePlaceholder)}
        {showWho && segment('who', t.search.who, <Users size={13} aria-hidden="true" />, whoValue, t.search.whoPlaceholder)}

        <button type="button" className={s.submit} onClick={submit}>
          <Search size={18} className={s.submitIcon} aria-hidden="true" />
          <span className={s.submitText}>{t.search.submit}</span>
        </button>
      </div>

      {Panel && openSeg && !stacked && (
        <Popover
          open
          onClose={() => setOpen(null)}
          anchorRef={refs[openSeg] as RefObject<HTMLElement | null>}
          label={panelTitle(openSeg)}
          matchWidth={openSeg === 'what'}
          minWidth={openSeg === 'what' ? 380 : 320}
        >
          <Panel {...panelProps} />
        </Popover>
      )}

      {Panel && openSeg && stacked && (
        <Dialog
          open
          onClose={() => setOpen(null)}
          title={panelTitle(openSeg)}
          footer={
            <Button variant="primary" size="lg" block leading={<Search size={18} />} onClick={submit}>
              {t.search.submit}
            </Button>
          }
        >
          <Panel {...panelProps} inSheet />
        </Dialog>
      )}
    </>
  );
}
