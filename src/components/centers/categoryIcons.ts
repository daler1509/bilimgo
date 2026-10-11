import {
  Award,
  Blocks,
  Bot,
  CodeXml,
  FlaskConical,
  GraduationCap,
  Languages,
  PencilLine,
  PenTool,
  School,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryId } from '@/data/types';

/**
 * One icon per direction, no repeats. Languages inside «Иностранные языки»
 * are shown as monograms (EN, DE, KO…) by CategoryGlyph; on map pins, where
 * only an icon fits, they use the parent's icon.
 */
export const CATEGORY_ICON: Record<CategoryId, LucideIcon> = {
  languages: Languages,
  english: Languages,
  russian: Languages,
  korean: Languages,
  german: Languages,
  japanese: Languages,
  french: Languages,
  ielts: Award,
  math: Sigma,
  sat: PencilLine,
  university: GraduationCap,
  subjects: FlaskConical,
  programming: CodeXml,
  design: PenTool,
  robotics: Bot,
  kids: Blocks,
};

/** For places whose directions are not published */
export const GENERIC_ICON: LucideIcon = School;
