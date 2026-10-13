import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Pause, Play, Star } from 'lucide-react';
import { PlaceBadges } from '@/components/centers/CenterBadges';
import { CenterLink } from '@/components/centers/CenterLink';
import { CenterLogo } from '@/components/centers/CenterLogo';
import { categoryLine, coverPhoto, districtLabel, openNow, priceLine } from '@/components/centers/centerText';
import { FadeImg } from '@/components/ui/FadeImg';
import type { Center } from '@/data/types';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { fill, t } from '@/i18n';
import { cn } from '@/lib/cn';
import s from './CenterCarousel.module.css';

/**
 * Centres as a centred, endless carousel: the active card at full size, its
 * neighbours smaller at the edges. A card leads with the building as seen
 * from the street; a centre without such a photo gets a plate with its mark
 * on the Samarkand tile pattern instead. It advances on its own; the timer is the
 * fill animation of the active dot, so every pause (hover, focus, touch,
 * scrolling, off screen, the pause button) stops both at once.
 * Swipe and scroll-snap are native; reduced motion turns autoplay off.
 *
 * Endless: the row is rendered three times and, once scrolling settles in an
 * outer copy, jumps to the same card in the middle copy — identical content,
 * so the jump is invisible. Copies are hidden from screen readers and the
 * tab order but stay clickable.
 */
export function CenterCarousel({ centers, label }: { centers: Center[]; label: string }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [rootRef, visible] = useInView<HTMLDivElement>({ threshold: 0.3, once: false });
  const still = useReducedMotion();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const count = centers.length;
  const loop = count > 2;
  const slides = loop ? [0, 1, 2].flatMap((copy) => centers.map((c) => ({ c, copy }))) : centers.map((c) => ({ c, copy: 1 }));
  /** index in the rendered row of the card closest to the centre */
  const nearestRef = useRef(loop ? count : 0);

  const autoplay = playing && !still && centers.length > 1;
  const paused = !autoplay || hovered || focused || scrolling || !visible;

  /* size the neighbours by their distance from the centre; runs per frame while scrolling */
  const frame = useRef(0);
  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const middle = track.scrollLeft + track.clientWidth / 2;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      let nearest = 0;
      let best = Infinity;
      [...track.children].forEach((el, i) => {
        const slide = el as HTMLElement;
        const offset = (slide.offsetLeft + slide.offsetWidth / 2 - middle) / (slide.offsetWidth + gap);
        slide.style.setProperty('--p', String(Math.max(0, 1 - Math.abs(offset))));
        if (Math.abs(offset) < best) {
          best = Math.abs(offset);
          nearest = i;
        }
      });
      nearestRef.current = nearest;
      setActive(nearest % count);
    });
  }, [count]);

  const centreOf = (track: HTMLElement, index: number) => {
    const slide = track.children[index] as HTMLElement | undefined;
    return slide ? slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2 : null;
  };

  /* start in the middle copy, before the first paint */
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !loop) return;
    const left = centreOf(track, count);
    if (left != null) track.scrollLeft = left;
    nearestRef.current = count;
    measure();
  }, [loop, count, measure]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let idle = 0;
    const onScroll = () => {
      measure();
      setScrolling(true);
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        setScrolling(false);
        // settled in an outer copy: step to the twin card in the middle copy
        const i = nearestRef.current;
        if (loop && (i < count || i >= 2 * count)) {
          const twin = i < count ? i + count : i - count;
          const left = centreOf(track, twin);
          if (left != null) track.scrollLeft = left;
          nearestRef.current = twin;
          measure();
        }
      }, 180);
    };
    measure();
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      window.clearTimeout(idle);
      cancelAnimationFrame(frame.current);
    };
  }, [measure, loop, count]);

  /** Scroll to a card of the rendered row (outer copies are fine — the jump follows) */
  const scrollToSlide = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const total = slides.length;
    const left = centreOf(track, loop ? Math.max(0, Math.min(total - 1, index)) : (index + total) % total);
    if (left != null) track.scrollTo({ left, behavior: still ? 'auto' : 'smooth' });
  };
  const step = (delta: number) => scrollToSlide(nearestRef.current + delta);
  const goTo = (i: number) => scrollToSlide(loop ? count + i : i);

  if (!centers.length) {
    return (
      <div className={s.carousel} aria-hidden="true">
        <ul className={s.track}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={cn(s.slide, s.placeholder)} />
          ))}
        </ul>
      </div>
    );
  }

  const current = centers[active];

  return (
    <div
      ref={rootRef}
      className={s.carousel}
      role="region"
      aria-roledescription={t.carousel.role}
      aria-label={label}
      data-paused={paused || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
    >
      <ul ref={trackRef} className={s.track}>
        {slides.map(({ c, copy }, n) => {
          const i = n % count;
          const twin = copy !== 1;
          const status = openNow(c);
          const cost = priceLine(c);
          const cover = coverPhoto(c);
          return (
            <li
              key={`${copy}-${c.id}`}
              className={s.slide}
              role={twin ? undefined : 'group'}
              aria-roledescription={twin ? undefined : t.carousel.slide}
              aria-label={twin ? undefined : fill(t.carousel.slideOf, { i: i + 1, n: count })}
              aria-hidden={twin || undefined}
            >
              <CenterLink id={c.id} className={s.card} data-active={i === active || undefined} tabIndex={twin ? -1 : undefined}>
                {cover ? (
                  <span className={s.cover}>
                    <FadeImg
                      src={cover.src}
                      width={cover.width}
                      height={cover.height}
                      alt=""
                      loading={n >= count && n < count + 3 ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable={false}
                    />
                    <PlaceBadges center={c} className={s.badges} />
                  </span>
                ) : (
                  <span className={cn(s.cover, s.plate)} aria-hidden="true">
                    <CenterLogo center={c} size={72} className={s.plateLogo} />
                    <PlaceBadges center={c} className={s.badges} />
                  </span>
                )}
                <span className={cn(s.top, !cover && s.topPlain)}>
                  {cover && <CenterLogo center={c} size={56} className={s.logo} />}
                  {status && (
                    <span className={cn(s.status, status.open && s.open)}>
                      <span className={s.statusDot} aria-hidden="true" />
                      {status.label}
                    </span>
                  )}
                </span>
                <span className={s.name}>{c.name}</span>
                <span className={s.directions}>{categoryLine(c, 3)}</span>
                <span className={s.where}>
                  <MapPin size={14} aria-hidden="true" />
                  <span className={s.whereText}>{c.address ? `${c.address}, ${districtLabel(c)}` : districtLabel(c)}</span>
                </span>
                {(cost || c.rating) && (
                  <span className={s.facts}>
                    {cost && <span>{cost}</span>}
                    {c.rating && (
                      <span className={s.rating}>
                        <Star size={13} aria-hidden="true" />
                        {c.rating.value.toFixed(1)}, {c.rating.source.label}
                      </span>
                    )}
                  </span>
                )}
                <span className={s.more}>{t.carousel.more}</span>
              </CenterLink>
            </li>
          );
        })}
      </ul>

      <div className={s.controls}>
        <button type="button" className={cn(s.arrow, s.arrowStep)} aria-label={t.carousel.prev} onClick={() => step(-1)}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div className={s.dots}>
          {centers.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={s.dot}
              aria-label={`${i + 1}: ${c.name}`}
              aria-current={i === active || undefined}
              onClick={() => goTo(i)}
            >
              <span className={s.dotTrack}>
                {i === active && autoplay && <span key={active} className={s.dotFill} onAnimationEnd={() => step(1)} />}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className={cn(s.arrow, s.arrowStep)} aria-label={t.carousel.next} onClick={() => step(1)}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        {!still && (
          <button
            type="button"
            className={s.arrow}
            aria-label={playing ? t.carousel.pause : t.carousel.play}
            aria-pressed={!playing}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
        )}
      </div>

      {/* announce slide changes only when the carousel is not turning by itself */}
      <p className="sr-only" aria-live={autoplay && !paused ? 'off' : 'polite'}>
        {current ? fill(t.carousel.status, { i: active + 1, n: count, name: current.name }) : ''}
      </p>
    </div>
  );
}
