import { CATEGORY_BY_ID } from '@/data/categories';
import { DISTRICT_BY_ID } from '@/data/districts';
import type { Center, CategoryId } from '@/data/types';
import { fill, KIND_LABEL, locale, t } from '@/i18n';
import { distanceKm, formatDistance, ORIGIN } from '@/lib/geo';
import { formatOpeningHours, openStatus } from '@/lib/openingHours';

/** Presentation helpers shared by every centre surface (card, preview, page). */

/** «Иностранные языки» adds nothing next to a concrete language — hide the umbrella then */
export const visibleCategories = (c: Pick<Center, 'categories'>): CategoryId[] => {
  const concrete = c.categories.filter((id) => id !== 'languages');
  return concrete.length ? concrete : c.categories;
};

/** "Английский язык, IELTS и CEFR +3" — or the kind of place when directions are unknown */
export const categoryLine = (c: Pick<Center, 'categories' | 'kind'>, max = 2) => {
  const ids = visibleCategories(c);
  if (!ids.length) return KIND_LABEL[c.kind];
  const labels = ids.slice(0, max).map((id) => CATEGORY_BY_ID[id].label);
  const rest = ids.length - max;
  return rest > 0 ? `${labels.join(', ')} +${rest}` : labels.join(', ');
};

/** A published lowest price, or null — never estimated */
export const priceLine = (c: Pick<Center, 'priceFrom'>) =>
  c.priceFrom ? fill(t.price.from, { amount: c.priceFrom.amount.toLocaleString('ru-RU').replace(/\u00a0/g, ' '), per: t.price.per[c.priceFrom.per] }) : null;

/** The photo of the building from outside, if the centre published one */
export const exteriorPhoto = (c: Pick<Center, 'photos'>) => c.photos?.find((p) => p.view === 'exterior') ?? null;

/** What a course request can be about: published courses or, without them, the directions */
export const leadCourses = (c: Center): string[] =>
  c.programs?.length ? c.programs.map((p) => p.title) : visibleCategories(c).map((id) => CATEGORY_BY_ID[id].label);

export const primaryCategory = (c: Center): CategoryId | null => visibleCategories(c)[0] ?? null;

/** Most specific first: «English Kids» is a kids course, «CEFR и ДТМ» an exam one */
const COURSE_DIRECTIONS: CategoryId[] = ['ielts', 'sat', 'korean', 'german', 'japanese', 'french', 'russian', 'robotics', 'design', 'programming', 'math', 'university', 'subjects', 'kids', 'english'];

/** The direction a course belongs to, read from its name: «IELTS Intensive» → ielts; unknown → fallback */
export function courseDirection(text: string, fallback: CategoryId | null): CategoryId | null {
  const lower = text.toLowerCase();
  const words = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const hit = (k: string) => (k.includes(' ') ? lower.includes(k) : k.length <= 3 ? words.includes(k) : words.some((w) => w.startsWith(k)));
  return COURSE_DIRECTIONS.find((id) => CATEGORY_BY_ID[id].keywords.some(hit)) ?? fallback;
}

export const districtLabel = (c: Center) => DISTRICT_BY_ID[c.districtId].label;

/** "1,7 км от Регистана" — the city's natural reference point */
export const distanceFromCenter = (c: Pick<Center, 'location'>) => `${formatDistance(distanceKm(c.location, ORIGIN))} ${t.center.fromRegistan}`;

export const kindLabel = (c: Center) => KIND_LABEL[c.kind];

export const hoursLine = (c: Center) => (c.openingHours ? formatOpeningHours(c.openingHours) : null);

export const openNow = (c: Center) => openStatus(c.openingHours);

/** Route in Yandex Maps — widely used in Uzbekistan */
export const routeUrl = (c: Center) => `https://yandex.uz/maps/?rtext=~${c.location.lat},${c.location.lng}&rtt=auto`;

export const telHref = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;

/** "https://instagram.com/english.standard/" → "@english.standard" */
export const handleOf = (url: string) => {
  const path = url
    .replace(/^https?:\/\/(www\.)?[^/]+\//, '')
    .replace(/\/$/, '')
    .replace(/^s\//, '');
  return path ? `@${path}` : url;
};

export const hostOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');

/** A source link in any language: "t.me/spm_community_uz", "spm.uz" */
export const sourceLabel = (url: string) => {
  const host = hostOf(url);
  const first = url.replace(/^https?:\/\/(www\.)?[^/]+\/?/, '').split(/[/?#]/)[0];
  return /^(t\.me|instagram\.com|facebook\.com)$/.test(host) && first ? `${host}/${first}` : host;
};

/** A second name written in Cyrillic is the Russian one — other languages keep just the main name */
export const altNameOf = (c: Pick<Center, 'altName'>) => (c.altName && (locale === 'ru' || !/[А-Яа-яЁё]/.test(c.altName)) ? c.altName : null);

/** Two letters for places without an official logo: «Najot Ta'lim» → «NT» */
export const monogram = (name: string) => {
  const words = name
    .replace(/[«»"'’`]/g, '')
    .split(/[\s&.-]+/)
    .filter((w) => /[\p{L}\d]/u.test(w));
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
};
