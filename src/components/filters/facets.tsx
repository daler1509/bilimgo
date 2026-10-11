import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { CategoryGlyph } from '@/components/centers/CategoryGlyph';
import { CATEGORIES, CATEGORY_TREE } from '@/data/categories';
import { DISTRICTS } from '@/data/districts';
import type { SearchFilters } from '@/data/types';
import { AGE_HINT, AGE_LABEL, FEATURE_LABEL, FORMAT_LABEL, t } from '@/i18n';
import { OPTIONS, type FacetKey } from '@/state/searchState';

export interface FacetOption {
  value: string;
  label: string;
  hint?: string;
  glyph?: ReactNode;
  countKey?: string;
  /** Child of the option before it (languages under «Иностранные языки») */
  nested?: boolean;
  /** Parent of the options that follow */
  hasChildren?: boolean;
}

export interface FacetConfig {
  key: FacetKey;
  label: string;
  /** Shown as a chip in the compact filter bar */
  primary?: boolean;
  options: FacetOption[];
  /** Which counts map (if any) provides the per-option counts */
  counts?: 'categories' | 'districts';
  note?: string;
}

/**
 * Single source of truth for every facet: the compact bar, the advanced
 * panel and the active-filter tags all read from here.
 */
export const FACETS: FacetConfig[] = [
  {
    key: 'categories',
    label: t.filters.category,
    primary: true,
    counts: 'categories',
    options: CATEGORY_TREE.map((c) => ({
      value: c.id,
      label: c.label,
      hint: c.hint,
      glyph: <CategoryGlyph id={c.id} size={32} />,
      nested: !!c.parent,
      hasChildren: CATEGORIES.some((x) => x.parent === c.id),
    })),
  },
  {
    key: 'districts',
    label: t.filters.district,
    primary: true,
    counts: 'districts',
    options: DISTRICTS.map((d) => ({
      value: d.id,
      label: d.label,
      hint: d.landmarks,
      glyph: (
        <span className="facet-place" aria-hidden="true">
          <MapPin size={16} strokeWidth={1.9} />
        </span>
      ),
    })),
  },
  {
    key: 'formats',
    label: t.filters.format,
    primary: true,
    options: OPTIONS.FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f] })),
  },
  {
    key: 'ages',
    label: t.filters.age,
    primary: true,
    options: OPTIONS.AGES.map((a) => ({ value: a, label: AGE_LABEL[a], hint: AGE_HINT[a] })),
  },
  {
    key: 'features',
    label: t.filters.features,
    options: OPTIONS.FEATURES.map((f) => ({ value: f, label: FEATURE_LABEL[f] })),
  },
];

export const FACET_BY_KEY = Object.fromEntries(FACETS.map((f) => [f.key, f])) as Record<FacetKey, FacetConfig>;

/** Values in a facet are plain strings in the UI */
export const facetValues = (filters: SearchFilters, key: FacetKey): string[] => filters[key].map(String);

export function setFacetValues(filters: SearchFilters, key: FacetKey, values: string[]): SearchFilters {
  return { ...filters, [key]: values } as SearchFilters;
}

export function toggleFacetValue(filters: SearchFilters, key: FacetKey, value: string): SearchFilters {
  const current = facetValues(filters, key);
  return setFacetValues(filters, key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
}

/** Human label for an active filter tag */
export const facetOptionLabel = (key: FacetKey, value: string) =>
  FACET_BY_KEY[key].options.find((o) => o.value === value)?.label ?? value;
