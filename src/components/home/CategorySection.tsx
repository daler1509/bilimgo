import { Link } from 'react-router';
import { CategoryGlyph } from '@/components/centers/CategoryGlyph';
import { RollingNumber } from '@/components/motion/RollingNumber';
import { CATEGORIES } from '@/data/categories';
import { countPlaces, fill, placesWord, t } from '@/i18n';
import { useAvailability } from '@/state/useCenterSearch';
import s from './Sections.module.css';

/** «Иностранные языки» on its own row plus two even rows of three */
const MAIN = 7;

/**
 * The main directions as a compact grid. «Иностранные языки» is the parent
 * of the languages, which sit inside its tile as monograms.
 */
export function CategorySection() {
  const { counts, topCategories } = useAvailability();
  const roots = topCategories.filter((c) => !c.parent).slice(0, MAIN);
  const childrenOf = (id: string) => CATEGORIES.filter((c) => c.parent === id && (counts?.categories[c.id] ?? 0) > 0);

  return (
    <section className={s.section} aria-labelledby="categories-title">
      <div className="container">
        <div className={s.headRow}>
          <h2 className={s.title} id="categories-title">
            {t.home.directions}
          </h2>
          <Link to="/search" className={s.headLink}>
            {t.home.allDirections}
          </Link>
        </div>
        <ul className={s.directions} aria-busy={!counts || undefined}>
          {roots.map((c) => {
            const kids = childrenOf(c.id);
            return (
              <li key={c.id} className={s.direction} data-wide={kids.length > 0 || undefined}>
                <Link className={s.directionLink} to={`/search?cat=${c.id}`}>
                  <CategoryGlyph id={c.id} size={40} />
                  <span className={s.directionText}>
                    <span className={s.directionName}>{c.label}</span>
                    <span className={s.directionCount}>
                      {counts && (
                        <>
                          <RollingNumber value={counts.categories[c.id] ?? 0} /> {placesWord(counts.categories[c.id] ?? 0)}
                        </>
                      )}
                    </span>
                  </span>
                </Link>
                {kids.length > 0 && (
                  <ul className={s.subList} aria-label={fill(t.home.languagesOf, { label: c.label })}>
                    {kids.map((k) => (
                      <li key={k.id}>
                        <Link className={s.sub} to={`/search?cat=${k.id}`} title={k.label} aria-label={`${k.label}: ${countPlaces(counts?.categories[k.id] ?? 0)}`}>
                          <span className={s.subMono}>{k.mono ?? k.label.split(' ')[0]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
