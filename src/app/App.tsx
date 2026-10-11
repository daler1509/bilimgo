import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { invalidateCenters } from '@/services/centersRepository';
import { locale, onLocaleChange } from '@/i18n';
import { CompareProvider } from '@/state/compare';
import { FavoritesProvider } from '@/state/favorites';
import { UiProvider } from '@/state/ui';
import '@/state/theme';
import { router } from './router';

/**
 * A language switch remounts the tree under a new key: every component reads
 * the new dictionary, the catalogue is rebuilt in that language, and the URL
 * (search, filters, selection) carries the state across.
 */
export function App() {
  const [lang, setLang] = useState(locale);
  useEffect(
    () =>
      onLocaleChange((next) => {
        invalidateCenters();
        setLang(next);
      }),
    [],
  );

  return (
    <UiProvider key={lang}>
      <FavoritesProvider>
        <CompareProvider>
          <RouterProvider router={router} />
        </CompareProvider>
      </FavoritesProvider>
    </UiProvider>
  );
}
