import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { RevealText } from '@/components/motion/RevealText';
import { RollingNumber } from '@/components/motion/RollingNumber';
import { SearchBar } from '@/components/search/SearchBar';
import { draftToFilters, emptyDraft, type SearchDraft } from '@/components/search/searchDraft';
import { t } from '@/i18n';
import { EMPTY_FILTERS, filtersToQueryString } from '@/state/searchState';
import { useAvailability, useSupportedIntents } from '@/state/useCenterSearch';
import s from './Hero.module.css';

/**
 * Above the fold: what the catalogue holds, in numbers, and the search.
 * The background carries a quiet girih lattice — the eight-point stars of
 * Samarkand tilework.
 */
export function Hero() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SearchDraft>(emptyDraft);
  const supported = useSupportedIntents();
  const { counts, districts } = useAvailability();
  const go = (d: SearchDraft) => navigate(`/search${filtersToQueryString(draftToFilters(d, EMPTY_FILTERS, supported))}`);

  const total = counts?.total ?? 0;
  const areas = districts.length;
  const ready = total > 0;

  // the headline waits for the real numbers; if they are slow, the plain title goes in
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setLate(true), 1500);
    return () => window.clearTimeout(id);
  }, [ready]);

  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={s.ornament} aria-hidden="true" />
      <div className={`container ${s.inner}`}>
        <RevealText as="h1" key={ready ? 'counted' : 'plain'} className={s.title} id="hero-title" play={ready || late}>
          {ready
            ? (() => {
                // word order differs by language («Samarqandning 8 ta hududida 30 ta…»), so the dictionary decides it
                let nth = 0;
                return t.home.heroTitle(total, areas).map((part, i) =>
                  typeof part === 'string' ? (
                    part
                  ) : (
                    <RollingNumber key={i} value={part.n} className={part.n === total ? s.number : undefined} immediate delay={200 + 220 * nth++} />
                  ),
                );
              })()
            : t.home.heroFallback}
        </RevealText>
        <p className={s.lead}>{t.home.heroLead}</p>

        <div className={s.searchWrap}>
          <SearchBar draft={draft} onChange={setDraft} onSubmit={() => go(draft)} id="hero-search" />
        </div>
      </div>
    </section>
  );
}
