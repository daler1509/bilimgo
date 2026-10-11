import { useEffect, useRef } from 'react';
import { locale } from '@/i18n';
import { useTheme } from '@/state/theme';
import s from './Turnstile.module.css';

/** Public site key of Cloudflare Turnstile; without it forms run unprotected, as before */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || null;

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;
function loadTurnstile() {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    script.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * The human check under a form. `onToken` gets a one-use token (or null when it
 * expires or fails); the server verifies it before anything is saved.
 * Nothing renders when no site key is configured.
 */
export function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const callback = useRef(onToken);
  callback.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !host.current) return;
    let id: string | null = null;
    let cancelled = false;
    callback.current(null);
    loadTurnstile()
      .then((api) => {
        if (cancelled || !host.current) return;
        id = api.render(host.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          language: locale,
          size: 'flexible',
          callback: (token: string) => callback.current(token),
          'expired-callback': () => callback.current(null),
          'error-callback': () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [theme, resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={host} className={s.widget} />;
}
