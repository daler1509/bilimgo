/** Dates, phone numbers and exports shared by the admin screens */

const TZ = 'Asia/Samarkand';

export const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ });

export const whenFull = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ });

/** «5 мин назад», «вчера в 14:20», «12 окт» — what a person says, not a timestamp */
export function ago(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const time = new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const days = Math.floor(hours / 24);
  if (days === 1) return `вчера в ${time}`;
  if (days < 7) return `${days} дн. назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: TZ });
}

/** Calendar day in Samarkand, YYYY-MM-DD */
export const dayKey = (iso: string | number | Date) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ });

/** "+998901234567" → "+998 90 123 45 67" */
export const prettyPhone = (p: string) => p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');

/** Opens a chat in Telegram by phone number */
export const telegramByPhone = (p: string) => `https://t.me/${p.startsWith('+') ? p : `+${p}`}`;

/** Names read the same without case, yo/ye and stray spaces */
export const normalize = (v: string) => v.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
};

/** A CSV file the admin can open in Excel or Google Sheets (BOM keeps Cyrillic intact) */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const text = v == null ? '' : String(v);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const body = [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
