import { isCategoryId } from '@/data/categories';
import { districtFor } from '@/data/districts';
import type { Center, CenterRecord, SearchFilters, SearchResponse } from '@/data/types';
import { SUPABASE } from '@/config/supabase';
import { distanceKm, isInBounds, ORIGIN } from '@/lib/geo';
import { switchLayout } from '@/lib/keyboardLayout';
import { allLanguages, categoryLabelsAll, local } from '@/i18n';
import type { FacetKey } from '@/state/searchState';
import { CENTER_COLUMNS, fromRow, samarkandDay, type CenterRow } from './centerRow';
import { restSelect } from './supabaseRest';

/**
 * Data access boundary. Components only talk to `centersRepository`.
 * The catalogue is loaded once — from Supabase when it is configured,
 * otherwise from the bundled snapshot — and searched in memory, so both
 * sources behave identically.
 */
export interface FacetCounts {
  categories: Record<string, number>;
  districts: Record<string, number>;
  /** How many centres carry any value for a facet — too few hides the filter */
  coverage: Record<FacetKey, number>;
  total: number;
  /** Latest day any record was checked (YYYY-MM-DD) */
  checkedAt: string;
}

export interface CentersRepository {
  search(filters: SearchFilters, opts?: RequestOptions): Promise<SearchResponse>;
  getById(id: string, opts?: RequestOptions): Promise<Center | null>;
  getByIds(ids: string[], opts?: RequestOptions): Promise<Center[]>;
  /** Other places of the same brand */
  getBranches(center: Center, opts?: RequestOptions): Promise<Center[]>;
  counts(): Promise<FacetCounts>;
}

export type MockScenario = 'ok' | 'empty' | 'error' | 'slow';

export interface RequestOptions {
  signal?: AbortSignal;
  /** Dev-only: force a UI state (driven by ?mock=error|empty|slow) */
  scenario?: MockScenario;
}

export class RequestError extends Error {
  constructor(message = 'Request failed') {
    super(message);
    this.name = 'RequestError';
  }
}

/* ---------- loading ---------- */

interface Loaded {
  record: CenterRecord;
  checkedAt: string;
}

async function loadRecords(): Promise<Loaded[]> {
  if (SUPABASE) {
    const rows = await restSelect<CenterRow>('centers', `select=${CENTER_COLUMNS}&published=eq.true&order=name`);
    return rows.map((row) => ({ record: fromRow(row), checkedAt: samarkandDay(row.updated_at!) }));
  }
  const { CENTER_RECORDS, DATA_CHECKED_AT } = await import('@/data/centers');
  return CENTER_RECORDS.map((record) => ({ record, checkedAt: DATA_CHECKED_AT }));
}

const STOP_WORDS = new Set(['для', 'в', 'во', 'на', 'с', 'по', 'и', 'курс', 'курсы', 'центр', 'занятия', 'уроки', 'uchun', 'va', 'kurs', 'kurslari', 'markaz', 'markazi', "o'quv", 'for', 'and', 'in', 'on', 'the', 'course', 'courses', 'centre', 'center']);
const normalize = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[‘’ʻʼ`]/g, "'");

interface Haystack {
  name: string;
  rest: string;
}

/** Words a centre can be found by — name, directions, programmes, address — in every language */
const haystackOf = (r: CenterRecord): Haystack => ({
  name: normalize(`${r.name} ${r.altName ?? ''} ${r.brand ?? ''} ${r.branch ?? ''}`),
  rest: normalize(
    [
      allLanguages(r.summary),
      allLanguages(r.address),
      ...r.categories.filter(isCategoryId).map(categoryLabelsAll),
      ...(r.programs ?? []).map((p) => `${allLanguages(p.title)} ${allLanguages(p.note)}`),
    ]
      .filter(Boolean)
      .join(' '),
  ),
});

/** The record in the current language — every text field becomes a plain string */
function resolve(r: CenterRecord, checkedAt: string): Center {
  return {
    ...r,
    // a direction removed from the taxonomy must not break the catalogue
    categories: r.categories.filter(isCategoryId),
    address: local(r.address),
    summary: local(r.summary),
    about: r.about?.map((p) => local(p) ?? '').filter(Boolean),
    programs: r.programs?.map((p) => ({ title: local(p.title) ?? '', note: local(p.note) })),
    audienceNote: local(r.audienceNote),
    photos: r.photos?.map((p) => ({ ...p, alt: local(p.alt) ?? '' })),
    districtId: districtFor(r.location),
    networkSize: 1,
    yandexUrl: `https://yandex.uz/maps/org/${r.yandexId}/`,
    checkedAt,
  };
}

interface Snapshot {
  centers: Center[];
  byId: Map<string, Center>;
  /** Yandex ratings summed over a brand's branches */
  brandRatings: Map<string, number>;
  haystack: Map<string, Haystack>;
  counts: FacetCounts;
}

/**
 * Marks in lists, both read off the number of ratings on a place's Yandex Maps
 * card (the number itself is never shown):
 *  «Популярно» — at least POPULAR_MIN_RATINGS ratings;
 *  «Лучший выбор» — the most rated place of each of the BEST_PICKS most rated
 *  networks. It is the catalogue's own pick, not a third-party award.
 */
export const POPULAR_MIN_RATINGS = 100;
export const BEST_PICKS = 3;

function markPopular(centers: Center[]) {
  const ranked = centers.filter((c) => (c.yandexRatingCount ?? 0) > 0).sort((a, b) => b.yandexRatingCount! - a.yandexRatingCount! || a.name.localeCompare(b.name, 'ru'));
  for (const c of ranked) if (c.yandexRatingCount! >= POPULAR_MIN_RATINGS) c.popular = true;
  const brands = new Set<string>();
  for (const c of ranked) {
    if (brands.size >= BEST_PICKS) break;
    const brand = c.brand ?? c.id;
    if (brands.has(brand)) continue;
    brands.add(brand);
    c.best = true;
    c.popular = true;
  }
}

function buildSnapshot(loaded: Loaded[]): Snapshot {
  const centers = loaded.map(({ record, checkedAt }) => resolve(record, checkedAt));
  const brandRatings = new Map<string, number>();
  const brandSize = new Map<string, number>();
  for (const c of centers) {
    const brand = c.brand ?? c.id;
    brandRatings.set(brand, (brandRatings.get(brand) ?? 0) + (c.yandexRatingCount ?? 0));
    brandSize.set(brand, (brandSize.get(brand) ?? 0) + 1);
  }
  for (const c of centers) c.networkSize = brandSize.get(c.brand ?? c.id) ?? 1;
  markPopular(centers);
  return {
    centers,
    byId: new Map(centers.map((c) => [c.id, c])),
    brandRatings,
    haystack: new Map(loaded.map(({ record }) => [record.id, haystackOf(record)])),
    counts: computeCounts(centers),
  };
}

let current: Promise<Snapshot> | null = null;
const invalidationListeners = new Set<() => void>();

/** The catalogue, loaded once and shared; a failed load is retried on the next call. */
function snapshot(): Promise<Snapshot> {
  if (!current) {
    const loading = loadRecords().then(buildSnapshot);
    current = loading;
    loading.catch(() => {
      if (current === loading) current = null;
    });
  }
  return current;
}

/** Drop the cached catalogue so the next read fetches it again (after an admin edit). */
export function invalidateCenters() {
  current = null;
  invalidationListeners.forEach((fn) => fn());
}

export function onCentersInvalidated(fn: () => void) {
  invalidationListeners.add(fn);
  return () => void invalidationListeners.delete(fn);
}

/** Lets one caller give up on the shared load without cancelling it for everyone */
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/* ---------- search ---------- */

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** Unknown values never match an active filter — we don't guess. */
const overlaps = <T,>(want: readonly T[], has: readonly T[] | undefined) => !want.length || (!!has && want.some((v) => has.includes(v)));

/** Every meaningful word has to match somewhere (AND) — predictable results. */
function textScore(hay: Haystack, q: string): number {
  const words = normalize(q)
    .split(/[\s,]+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  if (!words.length) return 1;

  const { name, rest } = hay;
  let score = 0;
  for (const w of words) {
    const stem = w.length > 5 ? w.slice(0, Math.max(4, w.length - 2)) : w;
    if (name.includes(w) || name.includes(stem)) score += 3;
    else if (rest.includes(w) || rest.includes(stem)) score += 1;
    else return 0;
  }
  return score;
}

/** Richer records are more useful to open first */
const completeness = (c: Center) =>
  (c.phones ? 0.2 : 0) + (c.openingHours ? 0.1 : 0) + (c.about ? 0.3 : c.summary ? 0.15 : 0) + (c.programs ? 0.2 : 0) + (c.logo ? 0.1 : 0);

function applyFilters(snap: Snapshot, f: SearchFilters): Center[] {
  const scored = snap.centers
    .filter(
      (c) =>
        overlaps(f.categories, c.categories) &&
        (!f.districts.length || f.districts.includes(c.districtId)) &&
        overlaps(f.formats, c.formats) &&
        overlaps(f.ages, c.ages) &&
        f.features.every((feat) => c.features?.includes(feat)) &&
        (!f.bounds || isInBounds(c.location, f.bounds)),
    )
    .flatMap((c) => {
      // the text decides whether a centre is in; completeness only orders what matched
      const text = textScore(snap.haystack.get(c.id)!, f.q);
      if (!text) return [];
      // a centre whose main direction is the one asked for ranks first
      const catBoost = f.categories.length && c.categories[0] && f.categories.includes(c.categories[0]) ? 1 : 0;
      return [{ c, score: text + catBoost + completeness(c) }];
    });

  const byName = (a: Center, b: Center) => a.name.localeCompare(b.name, 'ru');
  const dist = (c: Center) => distanceKm(c.location, ORIGIN);
  // ratings on the centre's own Yandex Maps card; the brand's total breaks ties between branches
  const ratings = (c: Center) => c.yandexRatingCount ?? 0;
  const brandRatings = (c: Center) => snap.brandRatings.get(c.brand ?? c.id) ?? 0;

  scored.sort((a, b) => {
    if (f.sort === 'name') return byName(a.c, b.c);
    if (f.sort === 'popular') return ratings(b.c) - ratings(a.c) || brandRatings(b.c) - brandRatings(a.c) || byName(a.c, b.c);
    if (f.sort === 'center') return dist(a.c) - dist(b.c);
    return b.score - a.score || byName(a.c, b.c);
  });
  return scored.map((x) => x.c);
}

function computeCounts(centers: Center[]): FacetCounts {
  const categories: Record<string, number> = {};
  const districts: Record<string, number> = {};
  const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v != null);
  const coverage: Record<FacetKey, number> = { categories: 0, districts: 0, formats: 0, ages: 0, features: 0 };
  let checkedAt = '';
  for (const c of centers) {
    for (const id of c.categories) categories[id] = (categories[id] ?? 0) + 1;
    districts[c.districtId] = (districts[c.districtId] ?? 0) + 1;
    if (c.categories.length) coverage.categories += 1;
    coverage.districts += 1;
    if (has(c.formats)) coverage.formats += 1;
    if (has(c.ages)) coverage.ages += 1;
    if (has(c.features)) coverage.features += 1;
    if (c.checkedAt > checkedAt) checkedAt = c.checkedAt;
  }
  return { categories, districts, coverage, total: centers.length, checkedAt };
}

/**
 * A facet is offered as a filter only when enough centres have data for it;
 * otherwise filtering would silently hide most of the city.
 */
export const MIN_FACET_COVERAGE = 0.5;
export const isFacetAvailable = (counts: FacetCounts | null, key: FacetKey) =>
  !!counts && counts.total > 0 && counts.coverage[key] >= counts.total * MIN_FACET_COVERAGE;

/** The bundled snapshot answers after a short delay so loading states stay honest; Supabase is real network. */
function createRepository(latencyMs: number): CentersRepository {
  return {
    async search(filters, opts = {}) {
      const { scenario = 'ok', signal } = opts;
      const [snap] = await Promise.all([abortable(snapshot(), signal), wait(scenario === 'slow' ? 2600 : latencyMs, signal)]);
      if (scenario === 'error') throw new RequestError();
      if (scenario === 'empty') return { items: [], total: 0 };
      const items = applyFilters(snap, filters);
      // nothing found: the query may have been typed in the other keyboard layout
      if (!items.length && filters.q.trim()) {
        const switched = switchLayout(filters.q);
        const retry = switched ? applyFilters(snap, { ...filters, q: switched }) : [];
        if (retry.length) return { items: retry, total: retry.length, correctedQuery: switched! };
      }
      return { items, total: items.length };
    },
    async getById(id, opts = {}) {
      const snap = await abortable(snapshot(), opts.signal);
      return snap.byId.get(id) ?? null;
    },
    async getByIds(ids, opts = {}) {
      const snap = await abortable(snapshot(), opts.signal);
      return ids.map((id) => snap.byId.get(id)).filter((c): c is Center => !!c);
    },
    async getBranches(center, opts = {}) {
      if (!center.brand) return [];
      const snap = await abortable(snapshot(), opts.signal);
      return snap.centers.filter((c) => c.brand === center.brand && c.id !== center.id);
    },
    async counts() {
      return (await snapshot()).counts;
    },
  };
}

export const centersRepository: CentersRepository = createRepository(SUPABASE ? 0 : 160);
