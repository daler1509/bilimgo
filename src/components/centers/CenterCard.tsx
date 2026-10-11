import { memo, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import type { Center } from '@/data/types';
import { fill, FEATURE_LABEL, t } from '@/i18n';
import { cn } from '@/lib/cn';
import { NetworkBadge, PlaceBadges } from './CenterBadges';
import { useFromHere } from './CenterLink';
import { CenterLogo } from './CenterLogo';
import { categoryLine, distanceFromCenter, leadCourses, openNow } from './centerText';
import { CompareButton } from './CompareButton';
import { FavoriteButton } from './FavoriteButton';
import { LeadDialog } from './LeadDialog';
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

/** Pictures in a card's strip: enough to get a feel, few enough to stay light */
const MAX_PHOTOS = 6;

/**
 * Result card: the place as a photo strip you can swipe, then who, what,
 * where and whether it's open, and the two next steps — details or a request.
 * The photo, the name and the card's empty space all do the primary action.
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
  const navigate = useNavigate();
  const photos = (c.photos ?? []).slice(0, MAX_PHOTOS);
  // mounted on first use: most cards are never asked for a request
  const [lead, setLead] = useState<'closed' | 'open'>('closed');
  const leadMounted = useRef(false);
  if (lead === 'open') leadMounted.current = true;

  // branches of one network share a name; the centre's own branch name tells them apart
  const name = (
    <>
      {c.name}
      {c.branch && <span className={s.branch}> {c.branch}</span>}
    </>
  );

  const primary = () => (primaryAction === 'link' ? navigate(detailsHref, { state: from }) : onSelect?.(c.id));

  return (
    <article
      className={cn(s.card, c.best && s.bestCard, selected && s.selected, highlighted && s.highlighted, compact && s.compact)}
      aria-labelledby={titleId}
      data-center-id={c.id}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover?.(c.id)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onHover?.(null)}
    >
      <Media center={c} photos={photos} onPrimary={primary} />

      <div className={s.body}>
        <div className={s.head}>
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
          <ButtonLink to={detailsHref} state={from} variant="secondary" size="md" className={s.action}>
            {t.results.details}
          </ButtonLink>
          <Button variant="primary" size="md" className={s.action} onClick={() => setLead('open')}>
            {t.courses.enroll}
          </Button>
        </div>
      </div>

      {leadMounted.current && (
        <LeadDialog open={lead === 'open'} onClose={() => setLead('closed')} center={c} courses={leadCourses(c)} course={null} />
      )}
    </article>
  );
});

/**
 * The strip: swipe (or the arrows, on a mouse) through the centre's photos.
 * Without photos — the centre's mark on the tile pattern, as on the home page.
 */
function Media({ center: c, photos, onPrimary }: { center: Center; photos: NonNullable<Center['photos']>; onPrimary: () => void }) {
  const strip = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const many = photos.length > 1;

  const onScroll = () => {
    const el = strip.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (delta: number) => {
    const el = strip.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, index + delta));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };
  // a tap on the picture does what the name does; buttons and swipes don't reach here
  const onClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button, a')) onPrimary();
  };

  return (
    // the strip is a pointer shortcut to the name's own action, which stays keyboard-reachable
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={cn(s.media, !photos.length && s.plate)} onClick={onClick}>
      {photos.length ? (
        <ul ref={strip} className={s.strip} onScroll={onScroll} aria-label={fill(t.gallery.label, { name: c.name })}>
          {photos.map((p, i) => (
            <li key={p.src} className={s.slide}>
              <img src={p.src} width={p.width} height={p.height} alt={p.alt} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
            </li>
          ))}
        </ul>
      ) : (
        <span className={s.plateMark} aria-hidden="true">
          <CenterLogo center={c} size={64} />
        </span>
      )}

      <PlaceBadges center={c} className={s.badges} />
      <FavoriteButton id={c.id} name={c.name} className={s.fav} />
      <CompareButton id={c.id} name={c.name} className={s.compare} />

      {many && (
        <>
          <button type="button" className={cn(s.arrow, s.arrowPrev)} onClick={() => go(-1)} aria-label={t.gallery.prev} disabled={index === 0}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className={cn(s.arrow, s.arrowNext)} onClick={() => go(1)} aria-label={t.gallery.next} disabled={index === photos.length - 1}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <span className={s.dots} aria-hidden="true">
            {photos.map((p, i) => (
              <span key={p.src} className={s.dot} data-on={i === index || undefined} />
            ))}
          </span>
        </>
      )}

      {photos.length > 0 && <CenterLogo center={c} size={48} className={s.logo} />}
    </div>
  );
}
