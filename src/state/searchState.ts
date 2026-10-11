import { isCategoryId } from '@/data/categories';
import { isDistrictId } from '@/data/districts';
import type { AgeGroup, CenterFeature, GeoBounds, LearningFormat, SearchFilters, SortKey } from '@/data/types';

/**
 * Search state ⇄ URL.
 *
 * URL is the single source of truth for search: it's shareable, survives
 * reloads and back/forward, and maps 1:1 onto a future API query string.
 *
 *   /search?q=english&cat=english,ielts&d=center&feat=free
 *          &bbox=w,s,e,n&sort=center&sel=<centerId>&v=<lat>,<lng>,<zoom>
 *
 * `v` zoom is a MapLibre / Web Mercator zoom level (512 px tiles).
 */

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  categories: [],
  districts: [],
  formats: [],
  ages: [],
  features: [],
  bounds: null,
  sort: 'relevance',
};

const FORMATS: LearningFormat[] = ['offline', 'online'];
const AGES: AgeGroup[] = ['kids', 'teens', 'adults'];
const FEATURES: CenterFeature[] = ['free'];
const SORTS: SortKey[] = ['relevance', 'popular', 'center', 'name'];

export const OPTIONS = { FORMATS, AGES, FEATURES };

const list = (p: URLSearchParams, key: string) =>
  (p.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const pick = <T extends string>(values: string[], allowed: readonly T[]) =>
  values.filter((v): v is T => (allowed as readonly string[]).includes(v));

function parseBounds(raw: string | null): GeoBounds | null {
  if (!raw) return null;
  const n = raw.split(',').map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [w, s, e, north] = n as [number, number, number, number];
  return w < e && s < north ? [w, s, e, north] : null;
}

export function filtersFromParams(p: URLSearchParams): SearchFilters {
  const sort = p.get('sort');
  return {
    q: (p.get('q') ?? '').slice(0, 120),
    categories: list(p, 'cat').filter(isCategoryId),
    districts: list(p, 'd').filter(isDistrictId),
    formats: pick(list(p, 'fmt'), FORMATS),
    ages: pick(list(p, 'age'), AGES),
    features: pick(list(p, 'feat'), FEATURES),
    bounds: parseBounds(p.get('bbox')),
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : 'relevance',
  };
}

/** Writes filters into params, keeping unrelated keys (sel, v, mock…) intact */
export function writeFilters(base: URLSearchParams, f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (key: string, value: string | null) => (value ? p.set(key, value) : p.delete(key));
  set('q', f.q.trim() || null);
  set('cat', f.categories.join(',') || null);
  set('d', f.districts.join(',') || null);
  set('fmt', f.formats.join(',') || null);
  set('age', f.ages.join(',') || null);
  set('feat', f.features.join(',') || null);
  set('bbox', f.bounds ? f.bounds.map((v) => v.toFixed(5)).join(',') : null);
  set('sort', f.sort === 'relevance' ? null : f.sort);
  return p;
}

export function filtersToQueryString(f: SearchFilters): string {
  const s = writeFilters(new URLSearchParams(), f).toString();
  return s ? `?${s}` : '';
}

/** Filters that are shown as removable chips (query and sort are separate) */
export type FacetKey = 'categories' | 'districts' | 'formats' | 'ages' | 'features';

export const FACET_KEYS: FacetKey[] = ['categories', 'districts', 'formats', 'ages', 'features'];

export function countActiveFacets(f: SearchFilters, keys: FacetKey[] = FACET_KEYS): number {
  return keys.reduce((n, k) => n + f[k].length, 0) + (keys === FACET_KEYS && f.bounds ? 1 : 0);
}

export function hasAnyFilter(f: SearchFilters): boolean {
  return countActiveFacets(f) > 0 || f.q.trim().length > 0;
}

export function toggleValue<T>(arr: readonly T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/* ---------- Map camera in URL ---------- */

export type CameraParam = { lat: number; lng: number; zoom: number };

export function cameraFromParams(p: URLSearchParams): CameraParam | null {
  const raw = p.get('v');
  if (!raw) return null;
  const [lat, lng, zoom] = raw.split(',').map(Number);
  if (![lat, lng, zoom].every((v) => Number.isFinite(v))) return null;
  // older links stored a different zoom unit — start from the default view
  if (zoom! < 1 || zoom! > 21) return null;
  return { lat: lat!, lng: lng!, zoom: zoom! };
}

export const cameraToParam = (c: CameraParam) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)},${c.zoom.toFixed(2)}`;
