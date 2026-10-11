/**
 * Domain model for BilimGo.
 *
 * These types are the contract between UI and data. Records come from
 * Supabase or the bundled snapshot (src/data/centers.ts);
 * services/centersRepository.ts is the only place that knows which.
 *
 * Rule: a field is filled only when a source says so. Unknown stays
 * undefined, and the UI says «нет данных» rather than guessing.
 */

export type LngLat = { lat: number; lng: number };

export type CategoryId =
  | 'english'
  | 'ielts'
  | 'russian'
  | 'korean'
  | 'german'
  | 'japanese'
  | 'french'
  | 'languages'
  | 'math'
  | 'sat'
  | 'university'
  | 'subjects'
  | 'programming'
  | 'design'
  | 'robotics'
  | 'kids';

/** Orientation areas of Samarkand, anchored on real places (see districts.ts) */
export type DistrictId = 'center' | 'university' | 'gagarin' | 'west' | 'afrasiab' | 'station' | 'old-city' | 'south';

export type LearningFormat = 'offline' | 'online';
export type AgeGroup = 'kids' | 'teens' | 'adults';
export type TeachingLanguage = 'uz' | 'ru' | 'en';
export type CenterFeature = 'free';

/** What kind of place it is — shown as «Тип» on the profile */
export type CenterKind =
  | 'learning_center'
  | 'language_school'
  | 'it_school'
  | 'tutoring'
  | 'kids_center'
  | 'technopark'
  | 'cultural_center'
  | 'exam_prep';

export interface Category {
  id: CategoryId;
  /** Nested direction (a language inside «Иностранные языки») */
  parent?: CategoryId;
  /** Two-letter mark used instead of an icon (EN, DE, KO…) */
  mono?: string;
  label: string;
  /** One short line shown on category cards */
  hint: string;
  /** Lowercase synonyms in ru / uz / en used by the query parser */
  keywords: string[];
}

export interface District {
  id: DistrictId;
  label: string;
  /** Orientation cue: well-known places nearby */
  landmarks: string;
  /** Real coordinates of the place the area is named after */
  anchor: LngLat;
  keywords: string[];
}

export interface SourceRef {
  label: string;
  url: string;
}

/** Interface and content languages */
export type Locale = 'ru' | 'uz' | 'en';

/** Text written for people, in up to three languages. Russian is always there; a missing translation falls back to it. */
export type LocalText = { ru: string; uz?: string; en?: string };

export interface ProgramRecord {
  title: LocalText;
  note?: LocalText;
}

/** A programme as shown, in the current language */
export interface Program {
  title: string;
  note?: string;
}

/** Where a photo comes from: the centre's own site or channel, or a free licence spelled out */
export type PhotoLicense = 'official-site' | 'official-telegram' | (string & {});

/**
 * A centre's own photo, from its official site or channel, or one under a
 * free licence. Owner and source link are always rendered.
 */
export interface CenterPhotoRecord {
  src: string;
  width: number;
  height: number;
  alt: LocalText;
  credit: string;
  license: PhotoLicense;
  sourceUrl: string;
  /** The building from outside — what the home carousel shows */
  view?: 'exterior' | 'interior';
}

export interface CenterPhoto extends Omit<CenterPhotoRecord, 'alt'> {
  alt: string;
}

/** One physical place, as stored in the data file */
export interface CenterRecord {
  id: string;
  name: string;
  altName?: string;
  /** Chain name when the brand has several branches */
  brand?: string;
  /** Branch nickname used by the centre itself («Gelion», «Plaza») */
  branch?: string;
  kind: CenterKind;
  /** Directions, most important first. Empty when no source names them. */
  categories: CategoryId[];
  location: LngLat;
  /** As on the Yandex Maps card in Russian; uz and en spell the street in Latin script */
  address?: LocalText;
  phones?: string[];
  website?: string;
  telegram?: string;
  instagram?: string;
  /** OpenStreetMap opening_hours syntax, e.g. "Mo-Sa 09:00-18:00; Su off" */
  openingHours?: string;
  /** One sentence for cards and previews */
  summary?: LocalText;
  /** Short paragraphs for the profile */
  about?: LocalText[];
  programs?: ProgramRecord[];
  ages?: AgeGroup[];
  audienceNote?: LocalText;
  formats?: LearningFormat[];
  teaching?: TeachingLanguage[];
  features?: CenterFeature[];
  /** Official mark: the centre's own site or Telegram channel */
  logo?: string;
  /** Lowest published price — only with a source, never estimated */
  priceFrom?: { amount: number; per: 'month' | 'course' | 'lesson'; source: SourceRef };
  /** Rating as published by a named source — never computed here */
  rating?: { value: number; count: number; source: SourceRef };
  photos?: CenterPhotoRecord[];
  /** Organisation card on Yandex Maps — base facts come from there */
  yandexId: string;
  /** Ratings on that card when the data was checked. Orders «По популярности»; never displayed. */
  yandexRatingCount?: number;
  /** Official sources behind directions and descriptions */
  sources: SourceRef[];
}

/** A record as the site shows it: texts already in the current language */
export interface Center extends Omit<CenterRecord, 'address' | 'summary' | 'about' | 'programs' | 'audienceNote' | 'photos'> {
  address?: string;
  summary?: string;
  about?: string[];
  programs?: Program[];
  audienceNote?: string;
  photos?: CenterPhoto[];
  districtId: DistrictId;
  /** Rated often on Yandex Maps: «Популярно» (see POPULAR_MIN_RATINGS) */
  popular?: boolean;
  /** One of the most rated networks of the catalogue: «Лучший выбор» (see BEST_PICKS) */
  best?: boolean;
  /** Places of the same network in the catalogue, this one included */
  networkSize: number;
  yandexUrl: string;
  /** Day the record was last checked or edited (YYYY-MM-DD) */
  checkedAt: string;
}

export type SortKey = 'relevance' | 'popular' | 'center' | 'name';

/** Map viewport bounds in geographic coordinates: [west, south, east, north] */
export type GeoBounds = [number, number, number, number];

export interface SearchFilters {
  q: string;
  categories: CategoryId[];
  districts: DistrictId[];
  formats: LearningFormat[];
  ages: AgeGroup[];
  features: CenterFeature[];
  bounds: GeoBounds | null;
  sort: SortKey;
}

export interface SearchResponse {
  items: Center[];
  total: number;
  /** The query as searched after fixing the keyboard layout («шудеы» → «ielts») */
  correctedQuery?: string;
}
