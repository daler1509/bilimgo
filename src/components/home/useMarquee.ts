import { useEffect, useRef, type RefObject } from 'react';

interface Options {
  /** Element that gets the transform (contains two identical groups) */
  trackRef: RefObject<HTMLElement | null>;
  /** First group — its width is one full loop */
  groupRef: RefObject<HTMLElement | null>;
  /** 1 → right-to-left, -1 → left-to-right */
  direction?: 1 | -1;
  /** Travel speed in px per second */
  speed?: number;
  /** Eases to a stop (hover) instead of cutting motion off */
  paused?: boolean;
  /** false renders a still line (not enough items to loop) */
  enabled?: boolean;
}

/**
 * Continuous marquee driven by one rAF loop and a single `transform` write
 * per frame — no layout properties are touched.
 *
 * The track holds the same group twice, so wrapping the offset by the group
 * width makes the loop seamless: the frame after the last item is the first
 * item, at exactly the same position.
 *
 * The loop stops when the section scrolls out of view, when the tab is
 * hidden, and entirely when the user asks for reduced motion.
 */
export function useMarquee({ trackRef, groupRef, direction = 1, speed = 38, paused = false, enabled = true }: Options) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const track = trackRef.current;
    const group = groupRef.current;
    if (!track || !group || !enabled) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = 0;
    let offset = direction === 1 ? 0 : -group.offsetWidth;
    let velocity = 0;
    let loopWidth = group.offsetWidth;
    let visible = true;

    const render = () => {
      track.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
    };

    const step = (now: number) => {
      const dt = Math.min(64, now - last || 16);
      last = now;
      const target = pausedRef.current ? 0 : -direction * speed;
      // exponential approach → smooth slow-down and pick-up, no jumps
      velocity += (target - velocity) * (1 - Math.exp(-dt / 140));
      offset += (velocity * dt) / 1000;
      if (loopWidth > 0) {
        if (offset <= -loopWidth) offset += loopWidth;
        else if (offset > 0) offset -= loopWidth;
      }
      render();
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (frame || motionQuery.matches || !visible) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onMotionChange = () => {
      if (motionQuery.matches) {
        stop();
        offset = 0;
        velocity = 0;
        track.style.transform = '';
      } else {
        start();
      }
    };

    const resize = new ResizeObserver(() => {
      loopWidth = group.offsetWidth;
      if (loopWidth > 0 && offset <= -loopWidth) offset = 0;
      if (!motionQuery.matches) render();
    });
    resize.observe(group);

    const io = new IntersectionObserver(
      (entries) => {
        // several changes can arrive in one batch (resize + scroll): the last one is current
        visible = !!entries[entries.length - 1]?.isIntersecting;
        if (visible) start();
        else stop();
      },
      { rootMargin: '120px' },
    );
    io.observe(track);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotionChange);

    if (!motionQuery.matches) {
      render();
      start();
    }

    return () => {
      stop();
      resize.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, [trackRef, groupRef, direction, speed, enabled]);
}
