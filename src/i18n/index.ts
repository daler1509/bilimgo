import type { AgeGroup, CategoryId, CenterFeature, CenterKind, DistrictId, LearningFormat, LocalText, Locale, SortKey, TeachingLanguage } from '@/data/types';
import { en } from './en';
import { ru } from './ru';
import { uz } from './uz';

/**
 * Interface languages. Russian is the reference; Uzbek (Latin script) and
 * English follow its shape exactly.
 *
 * `t`, the label maps and `locale` are live bindings: `setLocale` swaps them
 * and the app remounts (see LocaleProvider), so modules keep reading
 * `t.search.what` without threading a hook through every helper.
 */

export type { Locale, LocalText };
export const LOCALES: Locale[] = ['ru', 'uz', 'en'];

/** Same keys, any wording: string literals widen to string, functions stay */
type Widen<T> = T extends string
  ? string
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : { [K in keyof T]: Widen<T[K]> };

export type Dict = Widen<typeof ru>;

const DICTS: Record<Locale, Dict> = { ru, uz, en };
const STORAGE_KEY = 'bilimgo:locale';
const HTML_LANG: Record<Locale, string> = { ru: 'ru', uz: 'uz-Latn', en: 'en' };

const isLocale = (v: unknown): v is Locale => v === 'ru' || v === 'uz' || v === 'en';

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'ru';
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (isLocale(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* private mode — fall through */
  }
  const nav = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  if (nav.startsWith('uz')) return 'uz';
  if (nav.startsWith('en')) return 'en';
  return 'ru';
}

export let locale: Locale = initialLocale();
export let t: Dict = DICTS[locale];
export let FORMAT_LABEL: Record<LearningFormat, string> = t.labels.format;
export let AGE_LABEL: Record<AgeGroup, string> = t.labels.age;
export let AGE_HINT: Record<AgeGroup, string> = t.labels.ageHint;
export let LANGUAGE_LABEL: Record<TeachingLanguage, string> = t.labels.language;
export let FEATURE_LABEL: Record<CenterFeature, string> = t.labels.feature;
export let KIND_LABEL: Record<CenterKind, string> = t.labels.kind;
export let SORT_LABEL: Record<SortKey, string> = t.labels.sort;

const listeners = new Set<(l: Locale) => void>();

function apply(next: Locale) {
  locale = next;
  t = DICTS[next];
  FORMAT_LABEL = t.labels.format;
  AGE_LABEL = t.labels.age;
  AGE_HINT = t.labels.ageHint;
  LANGUAGE_LABEL = t.labels.language;
  FEATURE_LABEL = t.labels.feature;
  KIND_LABEL = t.labels.kind;
  SORT_LABEL = t.labels.sort;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = HTML_LANG[next];
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.meta.description);
  }
}
apply(locale);

export function setLocale(next: Locale) {
  if (next === locale) return;
  apply(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* not persisted — still switched for this visit */
  }
  listeners.forEach((fn) => fn(next));
}

export function onLocaleChange(fn: (l: Locale) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** "Оставить «{q}»" + { q: 'ielts' } */
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export const countPlaces = (n: number) => t.count.places(n);
export const placesWord = (n: number) => t.count.placesWord(n);

/** Category and district names in the current language */
export const categoryText = (id: CategoryId) => t.categories[id];
export const districtText = (id: DistrictId) => t.districts[id];

export const local = (text: LocalText | undefined): string | undefined => (text ? text[locale] || text.ru : undefined);

/** A direction's name in every language — search matches whichever the visitor types */
export const categoryLabelsAll = (id: CategoryId) => LOCALES.map((l) => DICTS[l].categories[id].label).join(' ');

/** Every language of a text, for search that should match whatever the visitor types */
export const allLanguages = (text: LocalText | undefined): string => (text ? [text.ru, text.uz, text.en].filter(Boolean).join(' ') : '');
