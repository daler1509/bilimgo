import { fill, t } from '@/i18n';

/**
 * OpenStreetMap `opening_hours` → text in the interface language and an
 * "open now" status.
 *
 * Supports the forms used by Samarkand's centres ("Mo-Sa 09:00-19:00",
 * "Mo-Fr 09:00-19:00; Sa 10:00-15:00; Su off", "…, 14:00-18:00", "24/7").
 * Anything else is shown verbatim and never gets a status — a wrong
 * "Открыто" is worse than none.
 */

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
const dayName = (d: string) => t.hours.days[DAYS.indexOf(d as (typeof DAYS)[number])] ?? d;

interface Rule {
  days: Set<number>;
  /** minutes from midnight; empty = closed */
  spans: [number, number][];
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

function parseDays(spec: string): Set<number> | null {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const [a, b] = part.split('-');
    const from = DAYS.indexOf(a as (typeof DAYS)[number]);
    const to = b ? DAYS.indexOf(b as (typeof DAYS)[number]) : from;
    if (from < 0 || to < 0) return null;
    for (let d = from; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === to) break;
    }
  }
  return out;
}

export function parseOpeningHours(value: string): Rule[] | 'always' | null {
  const v = value.trim();
  if (v === '24/7') return 'always';
  const rules: Rule[] = [];
  for (const chunk of v.split(';').map((c) => c.trim()).filter(Boolean)) {
    const m = /^([A-Za-z,-]+)\s+(.+)$/.exec(chunk);
    if (!m) return null;
    const days = parseDays(m[1]!);
    if (!days) return null;
    const times = m[2]!.trim();
    if (times === 'off' || times === 'closed') {
      rules.push({ days, spans: [] });
      continue;
    }
    const spans: [number, number][] = [];
    for (const span of times.split(',').map((x) => x.trim())) {
      const t = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(span);
      if (!t) return null;
      spans.push([toMinutes(t[1]!), toMinutes(t[2]!)]);
    }
    rules.push({ days, spans });
  }
  return rules.length ? rules : null;
}

/** "Mo-Sa 09:00-19:00" → "Пн–Сб 09:00–19:00" */
export function formatOpeningHours(value: string): string {
  if (value.trim() === '24/7') return t.hours.allDay;
  return value
    .replace(/(^|;\s*)Mo-Su\s/g, `$1${t.hours.daily} `)
    .replace(/,(?=\d)/g, ', ')
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (_, a: string, b: string) => `${dayName(a)}–${dayName(b)}`)
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => dayName(d))
    .replace(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g, '$1–$2')
    .replace(/\boff\b|\bclosed\b/g, t.hours.dayOff)
    .replace(/;\s*/g, '; ');
}

/** Current day (0 = Mon) and minutes in Samarkand, whatever the viewer's zone */
function nowInSamarkand(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Samarkand',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export type OpenStatus = { open: boolean; label: string } | null;

export function openStatus(value: string | undefined, date = new Date()): OpenStatus {
  if (!value) return null;
  const parsed = parseOpeningHours(value);
  if (!parsed) return null;
  if (parsed === 'always') return { open: true, label: t.hours.openAllDay };
  const { day, minutes } = nowInSamarkand(date);
  if (day < 0) return null;
  // later rules override earlier ones for the same day (OSM semantics)
  const rule = [...parsed].reverse().find((r) => r.days.has(day));
  const span = rule?.spans.find(([from, to]) => minutes >= from && minutes < to);
  if (span) return { open: true, label: fill(t.hours.openUntil, { time: hhmm(span[1]) }) };
  const next = rule?.spans.find(([from]) => from > minutes);
  return { open: false, label: next ? fill(t.hours.closedOpensAt, { time: hhmm(next[0]) }) : t.hours.closedNow };
}

export interface HoursRow {
  days: string;
  time: string;
  today: boolean;
  closed: boolean;
}

/** Rows for a schedule table: [{ days: 'Пн–Сб', time: '09:00–18:00', today }] */
export function hoursRows(value: string | undefined, date = new Date()): HoursRow[] {
  if (!value) return [];
  const v = value.trim();
  if (v === '24/7') return [{ days: t.hours.daily, time: t.hours.allDay, today: true, closed: false }];
  const { day } = nowInSamarkand(date);
  return v
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const m = /^([A-Za-z,-]+)\s+(.+)$/.exec(chunk);
      if (!m) return { days: '', time: formatOpeningHours(chunk), today: false, closed: false };
      const days = parseDays(m[1]!);
      const closed = m[2] === 'off' || m[2] === 'closed';
      const label = m[1] === 'Mo-Su' ? t.hours.daily : formatOpeningHours(m[1]!);
      return {
        days: label,
        time: closed ? t.hours.dayOff : formatOpeningHours(m[2]!).replace(/,\s*/g, ', '),
        today: !!days && days.has(day),
        closed,
      };
    });
}
