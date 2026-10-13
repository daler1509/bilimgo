import { useSyncExternalStore } from 'react';

/**
 * Light / dark. Until the visitor picks one, the site follows the system
 * setting (and keeps following it). index.html applies the same rule before
 * the first paint, so there is no flash of the wrong theme.
 */
export type Theme = 'light' | 'dark';

const KEY = 'bilimgo:theme';
const BAR: Record<Theme, string> = { light: '#f5f4f0', dark: '#0c1522' };
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readExplicit(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

let explicit = typeof window !== 'undefined' ? readExplicit() : null;
let current: Theme = explicit ?? (media?.matches ? 'dark' : 'light');
const listeners = new Set<() => void>();

function apply() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = current;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[current]);
}
apply();

media?.addEventListener('change', (e) => {
  if (explicit) return;
  current = e.matches ? 'dark' : 'light';
  apply();
  listeners.forEach((fn) => fn());
});

export function setTheme(next: Theme) {
  explicit = next;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* kept for this visit only */
  }
  // colours cross-fade for a moment; the first paint and system changes stay instant
  const root = document.documentElement;
  root.classList.add('theme-fade');
  apply();
  window.setTimeout(() => root.classList.remove('theme-fade'), 380);
  listeners.forEach((fn) => fn());
}

export const getTheme = () => current;

export function onThemeChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function useTheme(): Theme {
  return useSyncExternalStore(onThemeChange, getTheme, () => 'light');
}
