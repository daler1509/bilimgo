import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { CATEGORY_BY_ID } from '@/data/categories';
import { DISTRICT_BY_ID } from '@/data/districts';
import type { CategoryId, DistrictId } from '@/data/types';
import { fill, t } from '@/i18n';
import { formatDay } from '@/lib/dates';
import { useFacetCounts } from '@/state/useCenterSearch';
import s from './Footer.module.css';

/* The bottom tab bar already covers Search, Map, Favourites and Compare —
   the footer links go deeper instead. */
const CATEGORY_LINKS: CategoryId[] = ['languages', 'programming', 'university', 'kids'];
const DISTRICT_LINKS: DistrictId[] = ['center', 'gagarin', 'afrasiab', 'university'];

export function Footer() {
  const counts = useFacetCounts();
  const groups = [
    { title: t.footer.directions, links: CATEGORY_LINKS.map((id) => ({ to: `/search?cat=${id}`, label: CATEGORY_BY_ID[id].label })) },
    { title: t.footer.districts, links: DISTRICT_LINKS.map((id) => ({ to: `/search?d=${id}`, label: DISTRICT_BY_ID[id].label })) },
  ];

  return (
    <footer className={s.footer}>
      <div className={`container ${s.inner}`}>
        <div className={s.brand}>
          <Logo size={26} to="" />
          <p className={s.tagline}>{t.brand.tagline}</p>
          <Link to="/add-center" className={s.partner}>
            {t.footer.addCenter}
          </Link>
        </div>
        {groups.map((g) => (
          <nav key={g.title} className={s.group} aria-label={g.title}>
            <p className={s.groupTitle}>{g.title}</p>
            <ul className={s.groupList}>
              {g.links.map((l) => (
                <li key={l.to}>
                  <Link className={s.link} to={l.to}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container">
        <div className={s.bottom}>
          <p className={s.sourceNote}>
            {t.footer.sources}
            {counts && ` ${fill(t.footer.checked, { date: formatDay(counts.checkedAt) })}`} {t.footer.osmBefore}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>
            {t.footer.osmAfter}
          </p>
          <span className={s.copy}>© {new Date().getFullYear()} BilimGo</span>
        </div>
      </div>
    </footer>
  );
}
