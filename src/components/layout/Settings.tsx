import { useRef, useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { LOCALES, locale, setLocale, t, type Locale } from '@/i18n';
import { cn } from '@/lib/cn';
import { setTheme, useTheme } from '@/state/theme';
import s from './Settings.module.css';

const SHORT: Record<Locale, string> = { ru: 'RU', uz: 'UZ', en: 'EN' };

/** Language picker: the code of the current language opens the three choices */
export function LanguageMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={cn(s.control, className)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.settings.languageMenu}: ${t.settings.languages[locale]}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={s.code}>{SHORT[locale]}</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} align="end" label={t.settings.language} minWidth={180}>
        <ul className={s.menu} role="menu" aria-label={t.settings.language}>
          {LOCALES.map((l) => (
            <li key={l} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                lang={l === 'uz' ? 'uz-Latn' : l}
                className={s.option}
                onClick={() => {
                  setOpen(false);
                  setLocale(l);
                }}
              >
                <span>{t.settings.languages[l]}</span>
                {l === locale && <Check size={16} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}

/** One button: shows the theme you'd switch to */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={cn(s.control, s.icon, className)}
      aria-label={dark ? t.settings.themeToLight : t.settings.themeToDark}
      title={dark ? t.settings.themeToLight : t.settings.themeToDark}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
