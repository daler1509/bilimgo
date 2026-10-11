import { t } from '@/i18n';

/** "2026-09-24" → "24 сентября 2026" / "2026-yil 24-sentabr" / "24 September 2026" */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return t.dates.day(d, t.dates.months[m - 1] ?? '', y);
}
