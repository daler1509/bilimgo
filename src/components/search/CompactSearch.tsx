import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { SearchFilters } from '@/data/types';
import { CATEGORY_BY_ID } from '@/data/categories';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { useSupportedIntents } from '@/state/useCenterSearch';
import { draftFromFilters, draftToFilters } from './searchDraft';
import s from './CompactSearch.module.css';

interface Props {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}

/** Query field for the results panel: typing still goes through the parser. */
export function CompactSearch({ filters, onChange }: Props) {
  const [text, setText] = useState(filters.q);
  const supported = useSupportedIntents();
  useEffect(() => setText(filters.q), [filters.q]);

  const submit = () => {
    if (text === filters.q) return;
    onChange(draftToFilters({ ...draftFromFilters(filters), text }, filters, supported));
  };

  return (
    <form
      className={s.form}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Search size={17} className={s.icon} aria-hidden="true" />
      <input
        className={s.input}
        value={text}
        placeholder={t.search.whatPlaceholder}
        aria-label={t.search.what}
        onChange={(e) => setText(e.target.value)}
        onBlur={submit}
      />
      {text && (
        <button
          type="button"
          className={s.clear}
          aria-label={t.search.clear}
          onClick={() => {
            setText('');
            onChange({ ...filters, q: '' });
          }}
        >
          <X size={15} />
        </button>
      )}
    </form>
  );
}

/** Mobile: one tap opens the full search sheet. */
export function SearchSummaryPill({ filters, onOpen }: { filters: SearchFilters; onOpen: () => void }) {
  const parts = [filters.q, ...filters.categories.map((c) => CATEGORY_BY_ID[c].label)].filter(Boolean);
  const label = parts.join(', ');
  return (
    <button type="button" className={s.pill} onClick={onOpen} aria-label={t.search.editSearch}>
      <Search size={17} className={s.icon} aria-hidden="true" />
      <span className={cn(s.pillText, !label && s.pillPlaceholder)}>{label || t.search.summaryEmpty}</span>
      <span className={s.pillEdit} aria-hidden="true">
        <SlidersHorizontal size={15} />
      </span>
    </button>
  );
}
