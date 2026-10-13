/**
 * How complete a centre's profile is. The checks mirror what the public page
 * shows: a visitor missing any of these sees «нет данных» or an empty block.
 * Works on a `centers` row; the editor feeds it a draft in the same shape.
 */
export interface Completable {
  logo: string | null;
  photos: unknown[] | null;
  address: unknown | null;
  phones: string[] | null;
  opening_hours: string | null;
  website: string | null;
  telegram: string | null;
  instagram: string | null;
  summary: unknown | null;
  about: unknown[] | null;
  programs: unknown[] | null;
  ages: string[] | null;
  formats: string[] | null;
  teaching: string[] | null;
  lessons: unknown[] | null;
  teachers: unknown[] | null;
}

export interface Check {
  key: string;
  label: string;
  /** The editor section that fixes it */
  section: string;
  done: (r: Completable) => boolean;
}

const has = (v: unknown[] | null | undefined) => !!v && v.length > 0;

export const CHECKS: Check[] = [
  { key: 'photos', label: 'Фото', section: 'photos', done: (r) => has(r.photos) },
  { key: 'logo', label: 'Логотип', section: 'photos', done: (r) => !!r.logo },
  { key: 'address', label: 'Адрес', section: 'where', done: (r) => !!r.address },
  { key: 'phones', label: 'Телефон', section: 'contacts', done: (r) => has(r.phones) },
  { key: 'hours', label: 'Часы работы', section: 'contacts', done: (r) => !!r.opening_hours },
  { key: 'links', label: 'Сайт или соцсети', section: 'contacts', done: (r) => !!(r.website || r.telegram || r.instagram) },
  { key: 'summary', label: 'Короткое описание', section: 'main', done: (r) => !!r.summary },
  { key: 'about', label: 'Описание «О центре»', section: 'about', done: (r) => has(r.about) },
  { key: 'programs', label: 'Курсы и программы', section: 'about', done: (r) => has(r.programs) },
  { key: 'format', label: 'Возраст, формат, язык', section: 'audience', done: (r) => has(r.ages) || has(r.formats) || has(r.teaching) },
  { key: 'lessons', label: 'Как проходят занятия', section: 'audience', done: (r) => has(r.lessons) },
  { key: 'teachers', label: 'Преподаватели', section: 'teachers', done: (r) => has(r.teachers) },
];

export interface Completeness {
  /** 0–100 */
  score: number;
  done: Check[];
  missing: Check[];
}

export function completeness(r: Completable): Completeness {
  const done = CHECKS.filter((c) => c.done(r));
  const missing = CHECKS.filter((c) => !c.done(r));
  return { score: Math.round((done.length / CHECKS.length) * 100), done, missing };
}

/** One colour language for the score: low reads as work to do, high as settled */
export const scoreTone = (score: number): 'low' | 'mid' | 'high' => (score >= 80 ? 'high' : score >= 50 ? 'mid' : 'low');
