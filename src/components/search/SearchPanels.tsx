import { MapPin, Search, Sparkles } from 'lucide-react';
import { CategoryGlyph } from '@/components/centers/CategoryGlyph';
import { Chip } from '@/components/ui/Chip';
import { OptionGroupTitle, OptionRow } from '@/components/ui/OptionRow';
import { CATEGORIES, CATEGORY_BY_ID } from '@/data/categories';
import { DISTRICTS, DISTRICT_BY_ID } from '@/data/districts';
import type { AgeGroup, LearningFormat } from '@/data/types';
import { AGE_HINT, AGE_LABEL, FORMAT_LABEL, t } from '@/i18n';
import { parseQuery } from '@/lib/queryParser';
import { toggleValue } from '@/state/searchState';
import { useAvailability, useFacetCounts } from '@/state/useCenterSearch';
import type { SearchDraft } from './searchDraft';
import s from './SearchBar.module.css';

interface PanelProps {
  draft: SearchDraft;
  onChange: (patch: Partial<SearchDraft>) => void;
  onDone: () => void;
  onSubmit: () => void;
  /** Rendered in a mobile sheet: the panel carries its own text field */
  inSheet?: boolean;
}

/** "What do you want to learn" — suggestions plus what the parser understood. */
export function WhatPanel({ draft, onChange, onDone, onSubmit, inSheet }: PanelProps) {
  const counts = useFacetCounts();
  const available = useAvailability();
  const query = draft.text.trim().toLowerCase();
  const parsed = parseQuery(draft.text);
  const withData = available.topCategories.length ? available.topCategories : CATEGORIES;
  const roots = withData.filter((c) => !c.parent);

  // no query: the main directions; typing searches every level, languages included
  const matches = query
    ? withData.filter((c) => c.label.toLowerCase().includes(query) || c.keywords.some((k) => k.includes(query) || query.includes(k)))
    : roots;
  const list = (matches.length ? matches : roots).slice(0, 8);

  // only what will really become a filter
  const tokens = [
    ...parsed.categories.map((id) => CATEGORY_BY_ID[id].label),
    ...parsed.districts.map((id) => DISTRICT_BY_ID[id].label),
    ...(available.facet('ages') ? parsed.ages.map((a) => AGE_LABEL[a]) : []),
    ...(available.facet('formats') ? parsed.formats.map((f) => FORMAT_LABEL[f]) : []),
  ];

  return (
    <div className={s.panel}>
      {inSheet && (
        <label className={s.sheetField}>
          <Search size={18} aria-hidden="true" />
          <input
            className={s.sheetInput}
            type="search"
            enterKeyHint="search"
            value={draft.text}
            placeholder={t.search.sheetPlaceholder}
            aria-label={t.search.what}
            onChange={(e) => onChange({ text: e.target.value, categories: [] })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </label>
      )}
      {tokens.length > 0 && (
        <div className={s.understood}>
          <span className={s.understoodLabel}>
            <Sparkles size={13} aria-hidden="true" />
            {t.search.understood}:
          </span>
          {tokens.map((tok) => (
            <span key={tok} className={s.token}>
              {tok}
            </span>
          ))}
        </div>
      )}

      <div className={s.panelSection} role="group" aria-label={t.search.directions}>
        <OptionGroupTitle>{t.search.directions}</OptionGroupTitle>
        {list.map((c) => (
          <OptionRow
            key={c.id}
            selected={draft.categories.includes(c.id)}
            onSelect={() => {
              const next = toggleValue(draft.categories, c.id);
              onChange({ categories: next, text: next.length ? '' : draft.text });
              if (next.length) onDone();
            }}
            glyph={<CategoryGlyph id={c.id} size={34} />}
            label={c.label}
            hint={c.hint}
            count={counts?.categories[c.id]}
          />
        ))}
      </div>
    </div>
  );
}

/** "Where in Samarkand" — districts with landmark hints. */
export function WherePanel({ draft, onChange }: PanelProps) {
  const counts = useFacetCounts();
  const available = useAvailability();
  return (
    <div className={s.panel} role="group" aria-label={t.search.districts}>
      <OptionRow
        selected={draft.districts.length === 0}
        onSelect={() => onChange({ districts: [] })}
        glyph={
          <span className={s.districtGlyph}>
            <MapPin size={16} />
          </span>
        }
        label={t.search.anyDistrict}
        hint={t.search.anyDistrictHint}
        multi={false}
      />
      <div className={s.panelSection}>
        <OptionGroupTitle>{t.search.districts}</OptionGroupTitle>
        {(available.districts.length ? available.districts : DISTRICTS).map((d) => (
          <OptionRow
            key={d.id}
            selected={draft.districts.includes(d.id)}
            onSelect={() => onChange({ districts: toggleValue(draft.districts, d.id) })}
            glyph={
              <span className="facet-place" aria-hidden="true">
                <MapPin size={16} strokeWidth={1.9} />
              </span>
            }
            label={d.label}
            hint={d.landmarks}
            count={counts?.districts[d.id]}
          />
        ))}
      </div>
    </div>
  );
}

/** "Who is it for" — age groups and learning format. */
export function WhoPanel({ draft, onChange, onDone }: PanelProps) {
  const ages: AgeGroup[] = ['kids', 'teens', 'adults'];
  const formats: LearningFormat[] = ['offline', 'online'];
  return (
    <div className={s.panel}>
      <div role="group" aria-label={t.search.age}>
        <OptionGroupTitle>{t.search.age}</OptionGroupTitle>
        {ages.map((a) => (
          <OptionRow
            key={a}
            selected={draft.ages.includes(a)}
            onSelect={() => onChange({ ages: toggleValue(draft.ages, a) })}
            label={AGE_LABEL[a]}
            hint={AGE_HINT[a]}
          />
        ))}
      </div>
      <div className={s.panelSection} role="group" aria-label={t.search.format}>
        <OptionGroupTitle>{t.search.format}</OptionGroupTitle>
        <div className={s.chipRow}>
          {formats.map((f) => (
            <Chip key={f} size="sm" selected={draft.formats.includes(f)} onClick={() => onChange({ formats: toggleValue(draft.formats, f) })}>
              {FORMAT_LABEL[f]}
            </Chip>
          ))}
        </div>
      </div>
      <div className={s.panelFooter}>
        <button type="button" className={s.optionCount} onClick={() => onChange({ ages: [], formats: [] })}>
          {t.search.clear}
        </button>
        <Chip selected onClick={onDone}>
          {t.search.done}
        </Chip>
      </div>
    </div>
  );
}
