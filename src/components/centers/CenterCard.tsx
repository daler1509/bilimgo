import { memo } from 'react';
import { Link } from 'react-router';
import { Clock3, MapPin } from 'lucide-react';
import type { Center } from '@/data/types';
import { FEATURE_LABEL, t } from '@/i18n';
import { cn } from '@/lib/cn';
import { NetworkBadge, PopularBadge } from './CenterBadges';
import { useFromHere } from './CenterLink';
import { CenterLogo } from './CenterLogo';
import { categoryLine, distanceFromCenter, openNow } from './centerText';
import { CompareButton } from './CompareButton';
import { FavoriteButton } from './FavoriteButton';
import s from './CenterCard.module.css';

export interface CenterCardProps {
  center: Center;
  selected?: boolean;
  highlighted?: boolean;
  /** 'select' → click selects on map; 'link' → click opens the profile */
  primaryAction?: 'select' | 'link';
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  compact?: boolean;
  detailsHref: string;
}

/**
 * Result card: who, what, where and whether it's open — then the next step.
 * Favourite and compare stay quiet secondary actions.
 */
export const CenterCard = memo(function CenterCard({
  center: c,
  selected,
  highlighted,
  primaryAction = 'select',
  onSelect,
  onHover,
  compact,
  detailsHref,
}: CenterCardProps) {
  const status = openNow(c);
  const titleId = `center-${c.id}-title`;
  const free = c.features?.includes('free');
  const from = useFromHere();
  // branches of one network share a name; the centre's own branch name tells them apart
  const name = (
    <>
      {c.name}
      {c.branch && <span className={s.branch}> {c.branch}</span>}
    </>
  );

  return (
    <article
      className={cn(s.card, c.popular && s.popularCard, selected && s.selected, highlighted && s.highlighted, compact && s.compact)}
      aria-labelledby={titleId}
      data-center-id={c.id}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover?.(c.id)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onHover?.(null)}
    >
      <div className={s.top}>
        <CenterLogo center={c} size={compact ? 44 : 48} />
        <div className={s.head}>
          {c.popular && <PopularBadge className={s.badge} />}
          <h3 className={s.title} id={titleId}>
            {primaryAction === 'link' ? (
              <Link to={detailsHref} state={from} className={s.primary}>
                {name}
              </Link>
            ) : (
              <button type="button" className={s.primary} onClick={() => onSelect?.(c.id)} aria-pressed={!!selected}>
                {name}
              </button>
            )}
          </h3>
          <p className={s.directions}>{categoryLine(c, 3)}</p>
        </div>
        <FavoriteButton id={c.id} name={c.name} className={s.fav} />
      </div>

      <ul className={s.facts}>
        <li className={s.fact}>
          <MapPin size={14} aria-hidden="true" />
          <span className={s.truncate}>
            {c.address ?? '—'}
            <span className={s.distance}>, {distanceFromCenter(c)}</span>
          </span>
        </li>
        {(status || free || c.networkSize > 1) && (
          <li className={s.fact}>
            {status && (
              <span className={s.status} data-open={status.open}>
                <Clock3 size={14} aria-hidden="true" />
                {status.label}
              </span>
            )}
            {free && <span className={s.free}>{FEATURE_LABEL.free}</span>}
            <NetworkBadge center={c} />
          </li>
        )}
      </ul>

      <div className={s.footer}>
        <CompareButton id={c.id} name={c.name} className={s.action} />
        {primaryAction === 'select' ? (
          <Link to={detailsHref} state={from} className={s.details}>
            {t.results.details}
          </Link>
        ) : (
          <span className={s.detailsHint} aria-hidden="true">
            {t.results.details}
          </span>
        )}
      </div>
    </article>
  );
});
