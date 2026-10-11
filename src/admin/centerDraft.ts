import { CATEGORY_BY_ID, CATEGORY_TREE } from '@/data/categories';
import type {
  AgeGroup,
  CategoryId,
  CenterFeature,
  CenterKind,
  CenterPhotoRecord,
  CenterRecord,
  LearningFormat,
  LngLat,
  LocalText,
  Locale,
  TeachingLanguage,
} from '@/data/types';
import { parseOpeningHours } from '@/lib/openingHours';
import { isInCity } from '@/map/mapConfig';

/**
 * The editor works on strings (what inputs hold) and turns them into a
 * CenterRecord only on save, after validation. Data policy is enforced here:
 * price and rating need a source, photos need a licence and credit.
 *
 * Texts people read (address, summary, description, programmes, photo
 * captions) are kept in three languages; Russian is required, the others fall
 * back to it.
 */

/** One text in every language, as the inputs hold it */
export type LangText = Record<Locale, string>;

export const TEXT_LOCALES: Locale[] = ['ru', 'uz', 'en'];
export const emptyLang = (): LangText => ({ ru: '', uz: '', en: '' });
export const langOf = (v: LocalText | undefined): LangText => ({ ru: v?.ru ?? '', uz: v?.uz ?? '', en: v?.en ?? '' });

/** Back to the stored shape; nothing typed → undefined */
function toLocal(v: LangText): LocalText | undefined {
  const ru = v.ru.trim();
  if (!ru) return undefined;
  const out: LocalText = { ru };
  if (v.uz.trim()) out.uz = v.uz.trim();
  if (v.en.trim()) out.en = v.en.trim();
  return out;
}

const filled = (v: LangText) => TEXT_LOCALES.some((l) => v[l].trim());

/** Photo as edited: caption in three languages */
export type DraftPhoto = Omit<CenterPhotoRecord, 'alt'> & { alt: LangText };

export type PricePer = 'month' | 'course' | 'lesson';

export interface Draft {
  id: string;
  name: string;
  altName: string;
  brand: string;
  branch: string;
  kind: CenterKind | '';
  categories: CategoryId[];
  /** Main direction — stored first, drives the icon and ranking */
  primary: CategoryId | '';
  /** "39.654727, 66.975693" — as Yandex Maps copies it */
  coords: string;
  address: LangText;
  /** One phone per line */
  phones: string;
  website: string;
  telegram: string;
  instagram: string;
  openingHours: string;
  summary: LangText;
  /** Paragraphs separated by a blank line, per language */
  about: LangText;
  programs: { title: LangText; note: LangText }[];
  ages: AgeGroup[];
  audienceNote: LangText;
  formats: LearningFormat[];
  teaching: TeachingLanguage[];
  features: CenterFeature[];
  logo: string;
  price: { amount: string; per: PricePer; label: string; url: string } | null;
  rating: { value: string; count: string; label: string; url: string } | null;
  photos: DraftPhoto[];
  yandexId: string;
  /** Ratings on the Yandex Maps card — orders «По популярности» */
  yandexRatings: string;
  sources: { label: string; url: string }[];
  published: boolean;
}

export type DraftErrors = Record<string, string>;

export const emptyDraft = (): Draft => ({
  id: '',
  name: '',
  altName: '',
  brand: '',
  branch: '',
  kind: '',
  categories: [],
  primary: '',
  coords: '',
  address: emptyLang(),
  phones: '',
  website: '',
  telegram: '',
  instagram: '',
  openingHours: '',
  summary: emptyLang(),
  about: emptyLang(),
  programs: [],
  ages: [],
  audienceNote: emptyLang(),
  formats: [],
  teaching: [],
  features: [],
  logo: '',
  price: null,
  rating: null,
  photos: [],
  yandexId: '',
  yandexRatings: '',
  sources: [],
  published: true,
});

export function draftFromRecord(r: CenterRecord, published: boolean): Draft {
  return {
    id: r.id,
    name: r.name,
    altName: r.altName ?? '',
    brand: r.brand ?? '',
    branch: r.branch ?? '',
    kind: r.kind,
    categories: r.categories,
    primary: r.categories[0] ?? '',
    coords: `${r.location.lat}, ${r.location.lng}`,
    address: langOf(r.address),
    phones: (r.phones ?? []).join('\n'),
    website: r.website ?? '',
    telegram: r.telegram ?? '',
    instagram: r.instagram ?? '',
    openingHours: r.openingHours ?? '',
    summary: langOf(r.summary),
    about: Object.fromEntries(TEXT_LOCALES.map((l) => [l, (r.about ?? []).map((p) => p[l] ?? '').filter(Boolean).join('\n\n')])) as LangText,
    programs: (r.programs ?? []).map((p) => ({ title: langOf(p.title), note: langOf(p.note) })),
    ages: r.ages ?? [],
    audienceNote: langOf(r.audienceNote),
    formats: r.formats ?? [],
    teaching: r.teaching ?? [],
    features: r.features ?? [],
    logo: r.logo ?? '',
    price: r.priceFrom
      ? { amount: String(r.priceFrom.amount), per: r.priceFrom.per, label: r.priceFrom.source.label, url: r.priceFrom.source.url }
      : null,
    rating: r.rating
      ? { value: String(r.rating.value), count: String(r.rating.count), label: r.rating.source.label, url: r.rating.source.url }
      : null,
    photos: (r.photos ?? []).map((p) => ({ ...p, alt: langOf(p.alt) })),
    yandexId: r.yandexId,
    yandexRatings: r.yandexRatingCount != null ? String(r.yandexRatingCount) : '',
    sources: r.sources.map((s) => ({ ...s })),
    published,
  };
}

/* ---------- small parsers ---------- */

/** "39.65, 66.97" → point. Swapped pairs (lng, lat) are fixed when only that order lands in Samarkand. */
export function parseCoords(v: string): LngLat | null {
  const nums = v.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length !== 2) return null;
  const [a, b] = nums.map(Number) as [number, number];
  const direct = { lat: a, lng: b };
  const swapped = { lat: b, lng: a };
  return !isInCity(direct) && isInCity(swapped) ? swapped : direct;
}

/** Organisation id from a Yandex Maps link or the bare number */
export function parseYandexId(v: string): string {
  const t = v.trim();
  const m = /\/org\/(?:[^/?#]+\/)?(\d+)/.exec(t);
  return m ? m[1]! : t;
}

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

const handle = (v: string) => v.trim().replace(/^@/, '').replace(/\/+$/, '');

export function normalizeWebsite(v: string) {
  const t = v.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function normalizeTelegram(v: string) {
  const t = v.trim();
  if (!t) return '';
  const m = /(?:t\.me|telegram\.me)\/([A-Za-z0-9_+]+)/i.exec(t);
  return `https://t.me/${m ? m[1] : handle(t)}`;
}

export function normalizeInstagram(v: string) {
  const t = v.trim();
  if (!t) return '';
  const m = /instagram\.com\/([A-Za-z0-9_.]+)/i.exec(t);
  return `https://www.instagram.com/${m ? m[1] : handle(t)}/`;
}

const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/** Address of the page: «Интер Нэйшн (Гагарина)» → inter-neyshn-gagarina */
export function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (ch) => RU[ch] ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’ʻʼ`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** «английский + IELTS» picks the umbrella «Иностранные языки» too */
export function withParents(ids: CategoryId[]): CategoryId[] {
  const out = [...ids];
  for (const id of ids) {
    const parent = CATEGORY_BY_ID[id]?.parent;
    if (parent && !out.includes(parent)) out.push(parent);
  }
  return out;
}

/* ---------- save ---------- */

export function toRecord(d: Draft, isNew: boolean): { record: CenterRecord | null; errors: DraftErrors } {
  const e: DraftErrors = {};
  const need = (key: string, v: string, msg = 'Заполните это поле') => {
    if (!v.trim()) e[key] = msg;
  };

  const id = d.id.trim();
  if (isNew) {
    if (!id) e.id = 'Заполните это поле';
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) e.id = 'Только латиница, цифры и дефисы';
  }
  need('name', d.name);
  if (!d.kind) e.kind = 'Выберите тип';

  const location = parseCoords(d.coords);
  if (!d.coords.trim()) e.coords = 'Вставьте координаты из Яндекс Карт';
  else if (!location) e.coords = 'Формат: 39.654727, 66.975693';
  else if (!isInCity(location)) e.coords = 'Точка за пределами Самарканда';

  const yandexId = parseYandexId(d.yandexId);
  if (!yandexId) e.yandexId = 'Базовые факты берутся из карточки на Яндекс Картах — укажите её';
  else if (!/^\d+$/.test(yandexId)) e.yandexId = 'Нужен номер организации или ссылка на карточку';

  const ratingsText = d.yandexRatings.replace(/\s/g, '');
  const yandexRatingCount = ratingsText ? Number(ratingsText) : undefined;
  if (yandexRatingCount !== undefined && !(Number.isInteger(yandexRatingCount) && yandexRatingCount >= 0)) e.yandexRatings = 'Целое число оценок';

  const phones = d.phones
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
  if (phones.some((p) => !/^\+?[\d\s()-]{7,}$/.test(p))) e.phones = 'Один номер на строку: цифры, пробелы, скобки и +';

  const website = normalizeWebsite(d.website);
  if (website && !isHttpUrl(website)) e.website = 'Проверьте адрес сайта';

  const hours = d.openingHours.trim();
  if (hours && !parseOpeningHours(hours)) e.openingHours = 'Формат OpenStreetMap: Mo-Sa 09:00-18:00; Su off';

  const logo = d.logo.trim();
  if (logo && !logo.startsWith('/') && !isHttpUrl(logo)) e.logo = 'Загрузите файл или вставьте ссылку';

  const programs = d.programs.filter((p) => filled(p.title) || filled(p.note));
  programs.forEach((p, i) => {
    if (!p.title.ru.trim()) e[`programs.${i}.title`] = 'Нужно название на русском';
  });
  for (const [key, value] of [['summary', d.summary], ['audienceNote', d.audienceNote], ['about', d.about]] as const) {
    if (filled(value) && !value.ru.trim()) e[key] = 'Нужен текст на русском: остальные языки без него не покажутся';
  }

  const sources = d.sources.map((s) => ({ label: s.label.trim(), url: s.url.trim() })).filter((s) => s.label || s.url);
  sources.forEach((s, i) => {
    if (!s.label) e[`sources.${i}.label`] = 'Нужна подпись';
    if (!isHttpUrl(s.url)) e[`sources.${i}.url`] = 'Нужна ссылка https://…';
  });

  let priceFrom: CenterRecord['priceFrom'];
  if (d.price) {
    const amount = Number(d.price.amount.replace(/\s/g, ''));
    if (!Number.isInteger(amount) || amount <= 0) e['price.amount'] = 'Целое число сумов';
    need('price.label', d.price.label, 'Где опубликована цена');
    if (!isHttpUrl(d.price.url.trim())) e['price.url'] = 'Без ссылки на источник цену не показываем';
    priceFrom = { amount, per: d.price.per, source: { label: d.price.label.trim(), url: d.price.url.trim() } };
  }

  let rating: CenterRecord['rating'];
  if (d.rating) {
    const value = Number(d.rating.value.replace(',', '.'));
    const count = Number(d.rating.count.replace(/\s/g, ''));
    if (!(value > 0 && value <= 5)) e['rating.value'] = 'От 0 до 5';
    if (!Number.isInteger(count) || count < 1) e['rating.count'] = 'Сколько оценок';
    need('rating.label', d.rating.label, 'Чей это рейтинг');
    if (!isHttpUrl(d.rating.url.trim())) e['rating.url'] = 'Без ссылки на источник рейтинг не показываем';
    rating = { value, count, source: { label: d.rating.label.trim(), url: d.rating.url.trim() } };
  }

  d.photos.forEach((p, i) => {
    need(`photos.${i}.alt`, p.alt.ru, 'Что на фото (по-русски)');
    need(`photos.${i}.credit`, p.credit, 'Автор или владелец');
    need(`photos.${i}.license`, p.license, 'Лицензия или разрешение');
    if (!isHttpUrl(p.sourceUrl.trim())) e[`photos.${i}.sourceUrl`] = 'Откуда фото';
  });

  if (Object.keys(e).length || !location) return { record: null, errors: e };

  const selected = withParents(d.categories);
  const primary = d.primary && selected.includes(d.primary) ? d.primary : selected[0];
  const ordered = primary
    ? [primary, ...CATEGORY_TREE.map((c) => c.id).filter((c) => c !== primary && selected.includes(c))]
    : [];
  // paragraphs line up across languages by position
  const split = (v: string) =>
    v
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  const byLang = Object.fromEntries(TEXT_LOCALES.map((l) => [l, split(d.about[l])])) as Record<Locale, string[]>;
  const paragraphs = byLang.ru.map((ru, i) => toLocal({ ru, uz: byLang.uz[i] ?? '', en: byLang.en[i] ?? '' })!);
  const opt = (v: string) => v.trim() || undefined;
  const list = <T,>(v: T[]) => (v.length ? v : undefined);

  const record: CenterRecord = {
    id: isNew ? id : d.id,
    name: d.name.trim(),
    altName: opt(d.altName),
    brand: opt(d.brand),
    branch: opt(d.branch),
    kind: d.kind as CenterKind,
    categories: ordered,
    location,
    address: toLocal(d.address),
    phones: list(phones),
    website: website || undefined,
    telegram: opt(normalizeTelegram(d.telegram)),
    instagram: opt(normalizeInstagram(d.instagram)),
    openingHours: hours || undefined,
    summary: toLocal(d.summary),
    about: list(paragraphs),
    programs: list(
      programs.map((p) => {
        const note = toLocal(p.note);
        return note ? { title: toLocal(p.title)!, note } : { title: toLocal(p.title)! };
      }),
    ),
    ages: list(d.ages),
    audienceNote: toLocal(d.audienceNote),
    formats: list(d.formats),
    teaching: list(d.teaching),
    features: list(d.features),
    logo: logo || undefined,
    priceFrom,
    rating,
    photos: list(d.photos.map((p) => ({ ...p, alt: toLocal(p.alt)!, credit: p.credit.trim(), license: p.license.trim(), sourceUrl: p.sourceUrl.trim() }))),
    yandexId,
    yandexRatingCount,
    sources,
  };
  return { record, errors: {} };
}

/* ---------- from an application ---------- */

export interface SubmissionRow {
  id: string;
  name: string;
  address: string;
  phone: string;
  links: string | null;
  directions: string | null;
  contact: string;
  status: 'pending' | 'approved' | 'rejected';
  center_id: string | null;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Pre-fills what the applicant gave; directions stay for the admin to map to the taxonomy */
export function draftFromSubmission(s: SubmissionRow): Draft {
  const d = emptyDraft();
  d.name = s.name;
  d.id = slugify(s.name);
  d.address = { ...emptyLang(), ru: s.address };
  d.phones = s.phone;
  for (const token of (s.links ?? '').split(/[\s,]+/).filter(Boolean)) {
    if (/instagram\.com/i.test(token)) d.instagram ||= normalizeInstagram(token);
    else if (/(t|telegram)\.me\//i.test(token)) d.telegram ||= normalizeTelegram(token);
    else if (/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(token)) d.website ||= normalizeWebsite(token);
  }
  return d;
}
