/*
 * Mapping between a `public.centers` row and the app's CenterRecord.
 * Kept free of path aliases and runtime imports so the Node seed script
 * (supabase/seed-centers.mjs) can import it directly.
 *
 * The app's rule «unknown stays undefined» holds here too: null columns and
 * empty lists become undefined, so the UI keeps saying «нет данных».
 */
import type {
  AgeGroup,
  CategoryId,
  CenterFeature,
  CenterKind,
  CenterPhotoRecord,
  CenterRecord,
  LearningFormat,
  LocalText,
  ProgramRecord,
  SourceRef,
  TeachingLanguage,
} from '../data/types';

/** Rows written before texts became multilingual hold plain Russian strings */
type Legacy<T> = T | string;

export interface CenterRow {
  id: string;
  name: string;
  alt_name: string | null;
  brand: string | null;
  branch: string | null;
  kind: CenterKind;
  categories: CategoryId[];
  lat: number;
  lng: number;
  address: Legacy<LocalText> | null;
  phones: string[] | null;
  website: string | null;
  telegram: string | null;
  instagram: string | null;
  opening_hours: string | null;
  summary: Legacy<LocalText> | null;
  about: Legacy<LocalText>[] | null;
  programs: { title: Legacy<LocalText>; note?: Legacy<LocalText> }[] | null;
  ages: AgeGroup[] | null;
  audience_note: Legacy<LocalText> | null;
  formats: LearningFormat[] | null;
  teaching: TeachingLanguage[] | null;
  features: CenterFeature[] | null;
  logo: string | null;
  price_from: CenterRecord['priceFrom'] | null;
  rating: CenterRecord['rating'] | null;
  photos: (Omit<CenterPhotoRecord, 'alt'> & { alt: Legacy<LocalText> })[] | null;
  yandex_id: string;
  yandex_rating_count: number | null;
  sources: SourceRef[];
  published: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Columns the site reads — everything except bookkeeping it doesn't need */
export const CENTER_COLUMNS =
  'id,name,alt_name,brand,branch,kind,categories,lat,lng,address,phones,website,telegram,instagram,opening_hours,summary,about,programs,ages,audience_note,formats,teaching,features,logo,price_from,rating,photos,yandex_id,yandex_rating_count,sources,published,updated_at';

const text = (v: string | null | undefined) => (v && v.trim() ? v : undefined);

/**
 * Links and image paths from the database end up in href/src. Only http(s)
 * addresses and site-relative paths pass; «javascript:», «data:» and the like
 * are dropped, whatever a row happens to contain.
 */
const SAFE_URL = /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;
const url = (v: string | null | undefined) => {
  const t = text(v)?.trim();
  return t && SAFE_URL.test(t) ? t : undefined;
};

/** Accepts both the multilingual shape and a legacy plain string; empty becomes undefined */
const localText = (v: Legacy<LocalText> | null | undefined): LocalText | undefined => {
  if (!v) return undefined;
  if (typeof v === 'string') return v.trim() ? { ru: v } : undefined;
  if (!v.ru?.trim()) return undefined;
  const out: LocalText = { ru: v.ru.trim() };
  if (v.uz?.trim()) out.uz = v.uz.trim();
  if (v.en?.trim()) out.en = v.en.trim();
  return out;
};
const programOf = (p: { title: Legacy<LocalText>; note?: Legacy<LocalText> }): ProgramRecord | null => {
  const title = localText(p.title);
  if (!title) return null;
  const note = localText(p.note);
  return note ? { title, note } : { title };
};
const list = <T>(v: T[] | null | undefined) => (v && v.length ? v : undefined);
const orNull = <T>(v: T | undefined) => (v === undefined ? null : v);
const listOrNull = <T>(v: T[] | undefined) => (v && v.length ? v : null);
const textOrNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export function fromRow(r: CenterRow): CenterRecord {
  return {
    id: r.id,
    name: r.name,
    altName: text(r.alt_name),
    brand: text(r.brand),
    branch: text(r.branch),
    kind: r.kind,
    categories: r.categories ?? [],
    location: { lat: r.lat, lng: r.lng },
    address: localText(r.address),
    phones: list(r.phones),
    website: url(r.website),
    telegram: url(r.telegram),
    instagram: url(r.instagram),
    openingHours: text(r.opening_hours),
    summary: localText(r.summary),
    about: list((r.about ?? []).map(localText).filter((p): p is LocalText => !!p)),
    programs: list((r.programs ?? []).map(programOf).filter((p): p is ProgramRecord => !!p)),
    ages: list(r.ages),
    audienceNote: localText(r.audience_note),
    formats: list(r.formats),
    teaching: list(r.teaching),
    features: list(r.features),
    logo: url(r.logo),
    priceFrom: r.price_from ?? undefined,
    rating: r.rating ?? undefined,
    photos: list(
      (r.photos ?? [])
        .filter((p) => url(p.src) && url(p.sourceUrl))
        .map((p) => ({ ...p, alt: localText(p.alt) ?? { ru: '' } })),
    ),
    yandexId: r.yandex_id,
    yandexRatingCount: r.yandex_rating_count ?? undefined,
    sources: (r.sources ?? []).filter((x) => url(x.url)),
  };
}

export function toRow(c: CenterRecord, published = true): CenterRow {
  return {
    id: c.id,
    name: c.name.trim(),
    alt_name: textOrNull(c.altName),
    brand: textOrNull(c.brand),
    branch: textOrNull(c.branch),
    kind: c.kind,
    categories: c.categories,
    lat: c.location.lat,
    lng: c.location.lng,
    address: orNull(localText(c.address)),
    phones: listOrNull(c.phones),
    website: textOrNull(c.website),
    telegram: textOrNull(c.telegram),
    instagram: textOrNull(c.instagram),
    opening_hours: textOrNull(c.openingHours),
    summary: orNull(localText(c.summary)),
    about: listOrNull((c.about ?? []).map(localText).filter((p): p is LocalText => !!p)),
    programs: listOrNull((c.programs ?? []).map(programOf).filter((p): p is ProgramRecord => !!p)),
    ages: listOrNull(c.ages),
    audience_note: orNull(localText(c.audienceNote)),
    formats: listOrNull(c.formats),
    teaching: listOrNull(c.teaching),
    features: listOrNull(c.features),
    logo: textOrNull(c.logo),
    price_from: orNull(c.priceFrom),
    rating: orNull(c.rating),
    photos: listOrNull(c.photos),
    yandex_id: c.yandexId.trim(),
    yandex_rating_count: c.yandexRatingCount ?? null,
    sources: c.sources,
    published,
  };
}

/** A timestamp as a calendar day in Samarkand (YYYY-MM-DD) */
export const samarkandDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Samarkand' });
