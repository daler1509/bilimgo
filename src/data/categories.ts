import { categoryText } from '@/i18n';
import type { Category, CategoryId } from './types';

/**
 * Learning directions. Product taxonomy, independent of the data source.
 * Directions without any centre in the current data are hidden by the UI,
 * so the list can stay ahead of the data. Languages are nested under
 * «Иностранные языки»: every centre with a language also has the parent.
 *
 * Names and hints come from the interface dictionary (they follow the
 * language switch); keywords cover how people type in ru / uz / en.
 */
interface Spec {
  id: CategoryId;
  parent?: CategoryId;
  mono?: string;
  keywords: string[];
}

const SPECS: Spec[] = [
  {
    id: 'languages',
    keywords: ['языки', 'язык', 'иностранный', 'иностранные', 'языковая', 'language', 'languages', 'foreign', 'til', 'tillar', 'chet', 'турецкий', 'арабский'],
  },
  {
    id: 'english',
    parent: 'languages',
    mono: 'EN',
    keywords: ['английский', 'английскому', 'англ', 'english', 'ingliz', 'inglizcha'],
  },
  {
    id: 'ielts',
    parent: 'languages',
    keywords: ['ielts', 'айелтс', 'иелтс', 'айлтс', 'cefr', 'toefl', 'тоефл', 'multilevel'],
  },
  {
    id: 'russian',
    parent: 'languages',
    mono: 'RU',
    keywords: ['русский', 'русскому', 'rus tili', 'ruscha', 'russian'],
  },
  {
    id: 'korean',
    parent: 'languages',
    mono: 'KO',
    keywords: ['корейский', 'корейскому', 'topik', 'korean', 'koreys'],
  },
  {
    id: 'german',
    parent: 'languages',
    mono: 'DE',
    keywords: ['немецкий', 'немецкому', 'german', 'deutsch', 'nemis'],
  },
  {
    id: 'japanese',
    parent: 'languages',
    mono: 'JA',
    keywords: ['японский', 'японскому', 'japanese', 'yapon'],
  },
  {
    id: 'french',
    parent: 'languages',
    mono: 'FR',
    keywords: ['французский', 'французскому', 'french', 'fransuz', 'delf', 'tcf'],
  },
  {
    id: 'math',
    keywords: ['математика', 'математике', 'матем', 'алгебра', 'геометрия', 'math', 'maths', 'mathematics', 'matematika'],
  },
  {
    id: 'sat',
    keywords: ['sat', 'сат'],
  },
  {
    id: 'university',
    keywords: ['абитуриент', 'поступление', 'поступить', 'вуз', 'dtm', 'дтм', 'abituriyent', 'oliygoh', 'сертификат', 'sertifikat', 'certificate', 'university', 'президентская', 'президентские', 'prezident'],
  },
  {
    id: 'subjects',
    keywords: ['биология', 'химия', 'история', 'предметы', 'репетитор', 'репетиторство', 'kimyo', 'biologiya', 'tarix', 'fanlar', 'biology', 'chemistry', 'history', 'tutor'],
  },
  {
    id: 'programming',
    keywords: ['программирование', 'программированию', 'python', 'питон', 'it', 'айти', 'веб', 'frontend', 'backend', 'dasturlash', 'код', 'компьютер', 'компьютерные', 'kompyuter', 'programming', 'coding', 'computer'],
  },
  {
    id: 'design',
    keywords: ['дизайн', 'design', 'figma', 'графика', 'ui', 'ux', 'dizayn', 'photoshop'],
  },
  {
    id: 'robotics',
    keywords: ['робототехника', 'роботы', 'stem', 'robot', 'robotics', 'robototexnika', 'arduino', 'lego'],
  },
  {
    id: 'kids',
    keywords: ['дети', 'детей', 'ребёнка', 'ребенка', 'детский', 'школе', 'ментальная', 'арифметика', 'bolalar', 'kids', 'children', 'mental'],
  },
];

/** Name and hint are read at the moment they're shown, in the current language */
export const CATEGORIES: Category[] = SPECS.map((spec) => ({
  ...spec,
  get label() {
    return categoryText(spec.id).label;
  },
  get hint() {
    return categoryText(spec.id).hint;
  },
}));

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;

export const isCategoryId = (v: string): v is CategoryId => v in CATEGORY_BY_ID;

/** Top-level directions (no parent) */
export const ROOT_CATEGORIES = CATEGORIES.filter((c) => !c.parent);

/** Parents followed by their children — the order option lists use */
export const CATEGORY_TREE: Category[] = ROOT_CATEGORIES.flatMap((root) => [root, ...CATEGORIES.filter((c) => c.parent === root.id)]);
