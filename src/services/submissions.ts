import { SUPABASE } from '@/config/supabase';
import { captchaEnabled, submitProtected } from './protectedForms';
import { restInsert, SupabaseRestError } from './supabaseRest';

export interface SubmissionInput {
  name: string;
  address: string;
  phone: string;
  links: string;
  directions: string;
  contact: string;
}

/** Applications go to the moderation queue only when Supabase is configured */
export const submissionsEnabled = !!SUPABASE;

export type SubmitError = 'captcha' | 'throttled' | 'network';

export async function sendSubmission(v: SubmissionInput, token?: string | null): Promise<void> {
  const clean = (s: string) => s.trim() || null;
  const row = {
    name: v.name.trim(),
    address: v.address.trim(),
    phone: v.phone.trim(),
    links: clean(v.links),
    directions: clean(v.directions),
    contact: v.contact.trim(),
  };
  try {
    if (captchaEnabled) {
      if (!token) throw new Error('captcha');
      await submitProtected('submission', token, row);
    } else {
      await restInsert('submissions', row);
    }
  } catch (err) {
    if (err instanceof Error && (err.message === 'captcha' || err.message === 'throttled')) throw err;
    // schema.sql limits the whole site to 30 applications an hour
    const throttled = err instanceof SupabaseRestError && /too many submissions/i.test(err.message);
    throw new Error(throttled ? 'throttled' : 'network', { cause: err });
  }
}
