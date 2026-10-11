import { useNavigate } from 'react-router';
import { ChevronRight, Columns3, Heart, Trash2 } from 'lucide-react';
import { CenterCard } from '@/components/centers/CenterCard';
import { CenterCardSkeleton } from '@/components/centers/CenterCardSkeleton';
import { Footer } from '@/components/layout/Footer';
import { RevealText } from '@/components/motion/RevealText';
import { Button, ButtonLink } from '@/components/ui/Button';
import { StateMessage } from '@/components/ui/StateMessage';
import { countPlaces, fill, t } from '@/i18n';
import { useCompare } from '@/state/compare';
import { useFavorites } from '@/state/favorites';
import { useUi } from '@/state/ui';
import { useCentersByIds } from '@/state/useCenterSearch';
import s from './lists.module.css';

/** Saved places, newest first. Stored in this browser until accounts exist. */
export function FavoritesPage() {
  const favorites = useFavorites();
  const compare = useCompare();
  const { toast } = useUi();
  const navigate = useNavigate();
  const ids = [...favorites.ids].reverse();
  const centers = useCentersByIds(ids);

  const clearAll = () => {
    const previous = favorites.ids;
    favorites.clear();
    toast(t.saved.cleared, { label: t.common.undo, onClick: () => favorites.restore(previous) });
  };

  const compareSaved = () => {
    compare.restore(ids.slice(0, compare.max));
    navigate('/compare');
  };

  return (
    <div className={s.page}>
      <div className="container">
        <header className={s.header}>
          <div>
            <RevealText as="h1" className={s.title}>
              {t.saved.title}
            </RevealText>
            <p className={s.lead}>{ids.length ? fill(t.saved.countLead, { places: countPlaces(ids.length) }) : t.saved.lead}</p>
          </div>
          {ids.length > 0 && (
            <div className={s.headerActions}>
              {ids.length > 1 && (
                <Button variant="secondary" leading={<Columns3 size={16} />} onClick={compareSaved}>
                  {ids.length > compare.max ? fill(t.saved.compareFirst, { n: compare.max }) : t.saved.compareAll}
                </Button>
              )}
              <Button variant="ghost" leading={<Trash2 size={16} />} onClick={clearAll}>
                {t.saved.clear}
              </Button>
            </div>
          )}
        </header>

        {compare.ids.length > 0 && ids.length > 0 && (
          <ButtonLink to="/compare" variant="subtle" block className={s.banner} trailing={<ChevronRight size={16} />}>
            {fill(t.saved.compareOpen, { places: countPlaces(compare.ids.length) })}
          </ButtonLink>
        )}

        {ids.length === 0 ? (
          <div className={s.empty}>
            <StateMessage
              icon={<Heart size={24} />}
              title={t.saved.empty}
              text={t.saved.emptyText}
              actions={
                <ButtonLink to="/search" variant="primary">
                  {t.saved.open}
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <ul className={s.grid}>
            {centers === null
              ? ids.map((id) => (
                  <li key={id}>
                    <CenterCardSkeleton />
                  </li>
                ))
              : centers.map((c) => (
                  <li key={c.id}>
                    <CenterCard center={c} primaryAction="link" detailsHref={`/centers/${c.id}`} />
                  </li>
                ))}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  );
}
