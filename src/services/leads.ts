import { SUPABASE } from '@/config/supabase';
import type { Locale } from '@/data/types';
import { captchaEnabled, submitProtected } from './protectedForms';
import { restInsert, SupabaseRestError } from './supabaseRest';

/*
 * Course applications from a centre's page. Where they go, first match wins:
 *   VITE_LEADS_URL — POSTed as JSON to your own endpoint (your Telegram bot, a CRM…);
 *   Supabase       — a row in `leads`; the lead-to-telegram Edge Function forwards it to the bot;
 *   neither        — nothing is sent and the form says so.
 * The bot token never reaches the browser: it lives in the endpoint or in Edge Function secrets.
 */
const endpoint = import.meta.env.VITE_LEADS_URL?.trim();

export type LeadsMode = 'endpoint' | 'supabase' | 'off';
export const leadsMode: LeadsMode = endpoint ? 'endpoint' : SUPABASE ? 'supabase' : 'off';

export interface Lead {
  centerId: string;
  centerName: string;
  /** a course of the centre; null when the visitor asks for advice */
  course: string | null;
  name: string;
  /** +998 and nine digits */
  phone: string;
  comment: string;
  locale: Locale;
  page: string;
}

export type LeadError = 'captcha' | 'throttled' | 'network';

/** `token` is the Turnstile token; required whenever the captcha is configured */
export async function sendLead(lead: Lead, token?: string | null): Promise<void> {
  const row = {
    center_id: lead.centerId,
    center_name: lead.centerName,
    course: lead.course,
    name: lead.name.trim() || null,
    phone: lead.phone,
    comment: lead.comment.trim() || null,
    locale: lead.locale,
    page: lead.page,
  };
  try {
    if (leadsMode === 'endpoint') {
      const res = await fetch(endpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      if (res.status === 429) throw new Error('throttled');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } else if (leadsMode === 'supabase') {
      if (captchaEnabled) {
        if (!token) throw new Error('captcha');
        await submitProtected('lead', token, row);
      } else {
        await restInsert('leads', row);
      }
    } else {
      throw new Error('leads are not connected');
    }
  } catch (err) {
    // schema.sql: 60 leads an hour per site, 3 per phone number
    if (err instanceof Error && err.message === 'captcha') throw err;
    const throttled =
      (err instanceof Error && err.message === 'throttled') || (err instanceof SupabaseRestError && /too many leads/i.test(err.message));
    throw new Error(throttled ? 'throttled' : 'network', { cause: err });
  }
}

/** "901234567" → "90 123 45 67" */
export function formatPhoneDigits(digits: string) {
  const d = digits.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}

/** Whatever was typed or pasted, "+998 90 123 45 67" included → up to nine national digits */
export function phoneDigits(input: string) {
  let d = input.replace(/\D/g, '');
  if (d.length > 9 && d.startsWith('998')) d = d.slice(3);
  return d.slice(0, 9);
}
