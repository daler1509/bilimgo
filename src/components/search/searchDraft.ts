import type { AgeGroup, CategoryId, DistrictId, LearningFormat, SearchFilters } from '@/data/types';
import { parseQuery } from '@/lib/queryParser';
import { EMPTY_FILTERS } from '@/state/searchState';

/** What the search bar collects before it becomes a set of filters. */
export interface SearchDraft {
  text: string;
  categories: CategoryId[];
  districts: DistrictId[];
  ages: AgeGroup[];
  formats: LearningFormat[];
}

export const emptyDraft: SearchDraft = { text: '', categories: [], districts: [], ages: [], formats: [] };

export const draftFromFilters = (f: SearchFilters): SearchDraft => ({
  text: f.q,
  categories: f.categories,
  districts: f.districts,
  ages: f.ages,
  formats: f.formats,
});

const uniq = <T,>(a: T[]) => [...new Set(a)];

/**
 * Merges explicit choices with what the parser understood from free text.
 * Recognised words become real filters (visible as chips), the rest stays
 * as a text query — so the result is always explainable.
 */
export interface SupportedIntents {
  ages: boolean;
  formats: boolean;
}

/**
 * Intents the data can't answer yet (e.g. age groups before centres publish
 * them) are dropped rather than turned into filters that match nothing.
 */
export function draftToFilters(
  draft: SearchDraft,
  base: SearchFilters = EMPTY_FILTERS,
  supported: SupportedIntents = { ages: true, formats: true },
): SearchFilters {
  const parsed = parseQuery(draft.text);
  return {
    ...base,
    q: draft.categories.length && !parsed.rest ? '' : parsed.rest,
    categories: uniq([...draft.categories, ...parsed.categories]),
    districts: uniq([...draft.districts, ...parsed.districts]),
    ages: supported.ages ? uniq([...draft.ages, ...parsed.ages]) : [],
    formats: supported.formats ? uniq([...draft.formats, ...parsed.formats]) : [],
    bounds: null,
  };
}
