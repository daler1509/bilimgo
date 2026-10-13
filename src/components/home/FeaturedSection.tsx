import { useMemo } from 'react';
import { Link } from 'react-router';
import { coverPhoto, exteriorPhoto } from '@/components/centers/centerText';
import type { Center } from '@/data/types';
import { countPlaces, fill, t } from '@/i18n';
import { CenterCarousel } from './CenterCarousel';
import { CenterLogoMarquee } from './CenterLogoMarquee';
import s from './Featured.module.css';

const FEATURED = 12;
/** Below this many building photos the carousel is topped up with logo plates */
const MIN_SLIDES = 6;

interface Brand {
  /** the branch with the most Yandex Maps ratings stands for the network */
  best: Center;
  /** the most rated branch with a photo — a street view first — if any */
  cover: Center | null;
  total: number;
}

const ratings = (c: Center | null) => c?.yandexRatingCount ?? 0;

/** One entry per brand, networks ordered by the ratings of all their branches. */
function brandsByPopularity(centers: Center[]): Brand[] {
  const brands = new Map<string, Brand>();
  for (const c of centers) {
    const key = c.brand ?? c.id;
    let entry = brands.get(key);
    if (!entry) brands.set(key, (entry = { best: c, cover: null, total: 0 }));
    else if (ratings(c) > ratings(entry.best)) entry.best = c;
    entry.total += ratings(c);
    if (coverPhoto(c)) {
      // a street view beats an interior; among equals the more rated branch wins
      const better = !entry.cover || (!!exteriorPhoto(c) === !!exteriorPhoto(entry.cover) ? ratings(c) > ratings(entry.cover) : !!exteriorPhoto(c));
      if (better) entry.cover = c;
    }
  }
  return [...brands.values()].sort((a, b) => b.total - a.total || a.best.name.localeCompare(b.best.name, 'ru'));
}

/**
 * Popular centres right after the hero: networks with a photo turn as a
 * carousel, every centre of the catalogue follows as two
 * strips of marks moving in opposite directions.
 */
export function FeaturedSection({ centers }: { centers: Center[] }) {
  const { featured, marks } = useMemo(() => {
    const brands = brandsByPopularity(centers);
    const featured = brands.flatMap((b) => (b.cover ? [b.cover] : []));
    for (const b of brands) {
      if (featured.length >= MIN_SLIDES) break;
      if (!b.cover) featured.push(b.best);
    }
    return { featured: featured.slice(0, FEATURED), marks: brands.map((b) => b.best) };
  }, [centers]);

  return (
    <section className={s.section} aria-labelledby="featured-title">
      <div className="container">
        <div className={s.head}>
          <h2 className={s.title} id="featured-title">
            {t.home.popular}
          </h2>
          {centers.length > 0 && (
            <Link to="/search?sort=popular" className={s.all}>
              {fill(t.home.allPlaces, { places: countPlaces(centers.length) })}
            </Link>
          )}
        </div>
      </div>

      <CenterCarousel centers={featured} label={t.carousel.label} />

      {marks.length > 0 && <CenterLogoMarquee centers={marks} label={t.home.catalogStrip} />}
    </section>
  );
}
