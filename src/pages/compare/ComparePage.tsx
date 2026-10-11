import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Columns3, Link2, Plus, Trash2, X } from 'lucide-react';
import { CenterLink, useFromHere } from '@/components/centers/CenterLink';
import { CenterLogo } from '@/components/centers/CenterLogo';
import {
  categoryLine,
  distanceFromCenter,
  districtLabel,
  handleOf,
  hostOf,
  hoursLine,
  kindLabel,
  openNow,
  telHref,
} from '@/components/centers/centerText';
import { Footer } from '@/components/layout/Footer';
import { RevealText } from '@/components/motion/RevealText';
import { Button, ButtonLink } from '@/components/ui/Button';
import { StateMessage } from '@/components/ui/StateMessage';
import type { Center } from '@/data/types';
import { AGE_LABEL, FEATURE_LABEL, FORMAT_LABEL, countPlaces, fill, t } from '@/i18n';
import { cn } from '@/lib/cn';
import { COMPARE_MAX, useCompare } from '@/state/compare';
import { useFavorites } from '@/state/favorites';
import { useUi } from '@/state/ui';
import { useCentersByIds } from '@/state/useCenterSearch';
import lists from '../favorites/lists.module.css';
import s from './compare.module.css';

const NoData = () => (
  <span className={s.noData} title={t.center.noDataHint}>
    {t.center.noData}
  </span>
);

interface Row {
  label: string;
  render: (c: Center) => ReactNode;
}

/** Built per render: the labels follow the interface language */
const rows = (): Row[] => [
  { label: t.center.directions, render: (c) => (c.categories.length ? categoryLine(c, 6) : <NoData />) },
  { label: t.center.kind, render: (c) => kindLabel(c) },
  { label: t.center.address, render: (c) => c.address ?? <NoData /> },
  { label: t.center.district, render: (c) => `${districtLabel(c)}, ${distanceFromCenter(c)}` },
  {
    label: t.compare.now,
    render: (c) => {
      const st = openNow(c);
      return st ? <span data-open={st.open}>{st.label}</span> : <NoData />;
    },
  },
  { label: t.center.hours, render: (c) => hoursLine(c) ?? <NoData /> },
  { label: t.center.agesKnown, render: (c) => (c.ages?.length ? c.ages.map((a) => AGE_LABEL[a]).join(', ') : c.audienceNote ?? <NoData />) },
  { label: t.center.formats, render: (c) => (c.formats?.length ? c.formats.map((f) => FORMAT_LABEL[f]).join(', ') : <NoData />) },
  { label: t.filters.features, render: (c) => (c.features?.length ? c.features.map((f) => FEATURE_LABEL[f]).join(', ') : '—') },
  {
    label: t.center.programs,
    render: (c) =>
      c.programs?.length ? (
        <ul className={s.programs}>
          {c.programs.slice(0, 5).map((p) => (
            <li key={p.title}>{p.title}</li>
          ))}
          {c.programs.length > 5 && <li className={s.more}>{fill(t.compare.more, { n: c.programs.length - 5 })}</li>}
        </ul>
      ) : (
        <NoData />
      ),
  },
  {
    label: t.center.phone,
    render: (c) =>
      c.phones?.length ? (
        <span className={s.stack}>
          {c.phones.map((p) => (
            <a key={p} href={telHref(p)} className={s.link}>
              {p}
            </a>
          ))}
        </span>
      ) : (
        <NoData />
      ),
  },
  {
    label: t.compare.links,
    render: (c) =>
      c.website || c.telegram || c.instagram ? (
        <span className={s.stack}>
          {c.website && (
            <a href={c.website} target="_blank" rel="noopener noreferrer" className={s.link}>
              {hostOf(c.website)}
            </a>
          )}
          {c.telegram && (
            <a href={c.telegram} target="_blank" rel="noopener noreferrer" className={s.link}>
              Telegram {handleOf(c.telegram)}
            </a>
          )}
          {c.instagram && (
            <a href={c.instagram} target="_blank" rel="noopener noreferrer" className={s.link}>
              Instagram {handleOf(c.instagram)}
            </a>
          )}
        </span>
      ) : (
        <NoData />
      ),
  },
];

/** Side-by-side table of up to four places. Shareable via ?ids=a,b,c. */
export function ComparePage() {
  const compare = useCompare();
  const favorites = useFavorites();
  const { toast } = useUi();
  const [params, setParams] = useSearchParams();
  const from = useFromHere();

  // a shared link replaces the list once, then the URL is cleaned up
  useEffect(() => {
    const shared = params.get('ids');
    if (!shared) return;
    compare.restore(shared.split(',').filter(Boolean));
    params.delete('ids');
    setParams(params, { replace: true });
    // run once per shared link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centers = useCentersByIds(compare.ids);
  const candidates = favorites.ids.filter((id) => !compare.ids.includes(id));
  const suggestions = useCentersByIds(candidates);
  const items = centers ?? [];

  const clearAll = () => {
    const previous = compare.ids;
    compare.clear();
    toast(t.compare.cleared, { label: t.common.undo, onClick: () => compare.restore(previous) });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/compare?ids=${compare.ids.join(',')}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t.center.linkCopied);
    } catch {
      toast(url);
    }
  };

  return (
    <div className={lists.page}>
      <div className="container">
        <header className={lists.header}>
          <div>
            <RevealText as="h1" className={lists.title}>
              {t.compare.title}
            </RevealText>
            <p className={lists.lead}>
              {compare.ids.length ? `${fill(t.compare.count, { places: countPlaces(compare.ids.length), max: COMPARE_MAX })}. ${t.compare.lead}` : t.compare.lead}
            </p>
          </div>
          {compare.ids.length > 0 && (
            <div className={lists.headerActions}>
              <Button variant="secondary" leading={<Link2 size={16} />} onClick={copyLink}>
                {t.compare.copyLink}
              </Button>
              <Button variant="ghost" leading={<Trash2 size={16} />} onClick={clearAll}>
                {t.compare.clear}
              </Button>
            </div>
          )}
        </header>

        {compare.ids.length === 0 ? (
          <div className={lists.empty}>
            <StateMessage
              icon={<Columns3 size={24} />}
              title={t.compare.empty}
              text={t.compare.emptyText}
              actions={
                <>
                  {favorites.ids.length > 0 && (
                    <ButtonLink to="/favorites" variant="secondary">
                      {t.nav.saved}
                    </ButtonLink>
                  )}
                  <ButtonLink to="/search" variant="primary">
                    {t.saved.open}
                  </ButtonLink>
                </>
              }
            />
          </div>
        ) : (
          <>
            {compare.ids.length === 1 && <p className={s.hint}>{t.compare.needMore}</p>}
            <div className={s.scroller} role="region" aria-label={t.compare.table} tabIndex={0}>
              <table className={s.table} style={{ '--cols': Math.max(items.length, 1) } as CSSProperties}>
                <thead>
                  <tr>
                    <td className={s.corner} />
                    {items.map((c) => (
                      <th key={c.id} scope="col" className={s.head}>
                        <div className={s.headInner}>
                          <CenterLogo center={c} size={44} />
                          <CenterLink id={c.id} className={s.name}>
                            {c.name}
                            {c.branch && <span className={s.branch}> {c.branch}</span>}
                          </CenterLink>
                          <button
                            type="button"
                            className={s.remove}
                            onClick={() => compare.remove(c.id)}
                            aria-label={`${t.compare.remove}: ${c.name}`}
                            title={t.compare.remove}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows().map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className={s.rowLabel}>
                        {row.label}
                      </th>
                      {items.map((c) => (
                        <td key={c.id} className={s.cell}>
                          {row.render(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className={s.rowLabel} />
                    {items.map((c) => (
                      <td key={c.id} className={cn(s.cell, s.footCell)}>
                        <ButtonLink to={`/centers/${c.id}`} state={from} variant="secondary" size="sm">
                          {t.results.details}
                        </ButtonLink>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {compare.ids.length > 0 && compare.ids.length < COMPARE_MAX && suggestions && suggestions.length > 0 && (
          <section className={s.add} aria-labelledby="add-title">
            <h2 className={s.addTitle} id="add-title">
              {t.compare.addFromSaved}
            </h2>
            <ul className={s.addList}>
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button type="button" className={s.addItem} onClick={() => compare.add(c.id)}>
                    <CenterLogo center={c} size={32} />
                    <span className={s.addName}>{c.name}</span>
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <Footer />
    </div>
  );
}
