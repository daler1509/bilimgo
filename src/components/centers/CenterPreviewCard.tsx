import { Clock3, MapPin, Phone, X } from 'lucide-react';
import { ButtonLink, IconButton } from '@/components/ui/Button';
import type { Center } from '@/data/types';
import { t } from '@/i18n';
import { PlaceBadges } from './CenterBadges';
import { useFromHere } from './CenterLink';
import { CenterLogo } from './CenterLogo';
import { categoryLine, distanceFromCenter, openNow, telHref } from './centerText';
import { CompareButton } from './CompareButton';
import { FavoriteButton } from './FavoriteButton';
import s from './CenterPreviewCard.module.css';

interface Props {
  center: Center;
  detailsHref: string;
  onClose?: () => void;
  className?: string;
}

/**
 * Compact preview attached to a map marker (desktop) or docked at the
 * bottom of the map (phones). Only facts the sources know.
 */
export function CenterPreviewCard({ center: c, detailsHref, onClose, className }: Props) {
  const status = openNow(c);
  const phone = c.phones?.[0];
  const from = useFromHere();

  return (
    <section className={`${s.card} ${className ?? ''}`} aria-label={c.name}>
      <div className={s.head}>
        <CenterLogo center={c} size={44} />
        <div className={s.headText}>
          <PlaceBadges center={c} row className={s.badge} />
          <p className={s.title}>
            {c.name}
            {c.branch && <span className={s.branch}> {c.branch}</span>}
          </p>
          <p className={s.sub}>{categoryLine(c, 2)}</p>
        </div>
        {onClose && (
          <IconButton label={t.common.close} size="sm" round onClick={onClose} className={s.close}>
            <X size={16} />
          </IconButton>
        )}
      </div>

      {c.summary && <p className={s.summary}>{c.summary}</p>}

      <ul className={s.facts}>
        <li className={s.fact}>
          <MapPin size={14} aria-hidden="true" />
          <span className={s.truncate}>
            {c.address ?? '—'}, {distanceFromCenter(c)}
          </span>
        </li>
        {(status || phone) && (
          <li className={s.factRow}>
            {status && (
              <span className={s.fact} data-open={status.open}>
                <Clock3 size={14} aria-hidden="true" />
                {status.label}
              </span>
            )}
            {phone && (
              <a className={s.phone} href={telHref(phone)}>
                <Phone size={14} aria-hidden="true" />
                {phone}
              </a>
            )}
          </li>
        )}
      </ul>

      <div className={s.actions}>
        <div className={s.secondary}>
          <FavoriteButton id={c.id} name={c.name} />
          <CompareButton id={c.id} name={c.name} />
        </div>
        <ButtonLink to={detailsHref} state={from} variant="primary" size="sm">
          {t.results.details}
        </ButtonLink>
      </div>
    </section>
  );
}
