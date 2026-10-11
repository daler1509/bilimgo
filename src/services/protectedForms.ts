import { SUPABASE } from '@/config/supabase';
import { TURNSTILE_SITE_KEY } from '@/components/ui/Turnstile';

/** True when forms go through the Edge Function that checks the captcha */
export const captchaEnabled = !!TURNSTILE_SITE_KEY && !!SUPABASE;

export type ProtectedFormError = 'captcha' | 'throttled' | 'network';

/**
 * Sends a form to the submit-form Edge Function with the Turnstile token.
 * The function verifies the token and writes the row; the answer is mapped to
 * the three outcomes a form can show.
 */
export async function submitProtected(kind: 'lead' | 'submission', token: string, data: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE!.url}/functions/v1/submit-form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE!.anonKey },
      body: JSON.stringify({ kind, token, data }),
    });
  } catch (cause) {
    throw new Error('network', { cause });
  }
  if (res.ok) return;
  const reason: ProtectedFormError = res.status === 403 ? 'captcha' : res.status === 429 ? 'throttled' : 'network';
  throw new Error(reason);
}
