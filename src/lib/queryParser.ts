import { CATEGORIES } from '@/data/categories';
import { DISTRICTS } from '@/data/districts';
import type { AgeGroup, CategoryId, DistrictId, LearningFormat } from '@/data/types';

/**
 * Lightweight intent extraction for the hero search:
 *   "английский для детей на гагарина онлайн" →
 *   { categories: [english, kids], ages: [kids], districts: [gagarin], formats: [online] }
 *
 * Deterministic keyword matching — intentionally simple and explainable.
 * The UI shows what was understood, so the user stays in control.
 */

export interface ParsedQuery {
  categories: CategoryId[];
  districts: DistrictId[];
  ages: AgeGroup[];
  formats: LearningFormat[];
  /** Text left after removing recognised tokens (used for name search) */
  rest: string;
}

const AGE_WORDS: Record<AgeGroup, string[]> = {
  kids: ['дети', 'детей', 'детям', 'ребёнка', 'ребенка', 'малышей', 'школьников', 'bolalar', 'kids'],
  teens: ['подростков', 'подростки', 'подросткам', 'старшеклассников', 'teens', 'o‘smir', 'osmir'],
  adults: ['взрослых', 'взрослые', 'взрослым', 'adults', 'kattalar'],
};

const FORMAT_WORDS: Record<LearningFormat, string[]> = {
  online: ['онлайн', 'online', 'дистанционно'],
  offline: ['офлайн', 'оффлайн', 'offline', 'очно'],
};

const STOP_WORDS = new Set(['для', 'в', 'во', 'на', 'с', 'по', 'и', 'курсы', 'курс', 'центр', 'уроки', 'занятия', 'рядом', 'около', 'uchun', 'kurs', 'kurslari', 'va', 'markaz', 'markazi', "o'quv", 'for', 'and', 'in', 'on', 'the', 'course', 'courses', 'centre', 'center', 'near', 'class', 'classes']);

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[‘’ʻʼ`]/g, "'")
    .replace(/[.,!?;:()«»"“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function matches(tokens: string[], phrase: string): boolean {
  const p = normalize(phrase);
  if (p.includes(' ')) return tokens.join(' ').includes(p);
  // prefix match handles Russian case endings: "гагарина" → "гагарин"
  return tokens.some((t) => t === p || (p.length >= 4 && t.startsWith(p)) || (t.length >= 5 && p.startsWith(t)));
}

export function parseQuery(input: string): ParsedQuery {
  const text = normalize(input);
  const tokens = text.split(' ').filter(Boolean);
  const used = new Set<string>();

  const hit = (words: string[]) => {
    const found = words.some((w) => matches(tokens, w));
    if (found) {
      for (const w of words) {
        const nw = normalize(w);
        tokens.forEach((t) => {
          if (t === nw || (nw.length >= 4 && t.startsWith(nw)) || (t.length >= 5 && nw.startsWith(t))) used.add(t);
        });
      }
    }
    return found;
  };

  const matched = CATEGORIES.filter((c) => hit([c.label, ...c.keywords]));
  // «английский язык» also matches the parent «языки» — the concrete language wins
  const categories = matched.filter((c) => !matched.some((m) => m.parent === c.id)).map((c) => c.id);
  const districts = DISTRICTS.filter((d) => hit([d.label, ...d.keywords])).map((d) => d.id);
  const ages = (Object.keys(AGE_WORDS) as AgeGroup[]).filter((a) => hit(AGE_WORDS[a]));
  const formats = (Object.keys(FORMAT_WORDS) as LearningFormat[]).filter((f) => hit(FORMAT_WORDS[f]));

  const rest = tokens.filter((t) => !used.has(t) && !STOP_WORDS.has(t)).join(' ');
  return { categories, districts, ages, formats, rest };
}
