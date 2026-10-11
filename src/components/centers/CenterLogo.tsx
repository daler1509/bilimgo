import { useState, type CSSProperties } from 'react';
import type { Center } from '@/data/types';
import { fill, t } from '@/i18n';
import { cn } from '@/lib/cn';
import { monogram } from './centerText';
import s from './CenterLogo.module.css';

interface Props {
  center: Pick<Center, 'name' | 'logo'>;
  size?: number;
  className?: string;
  /** Decorative next to the name; pass false when the logo stands alone */
  decorative?: boolean;
  /** Load right away (moving marquee: lazy loading would pop images in) */
  eager?: boolean;
}

/**
 * The centre's own mark in a square tile. Without an official logo (or if
 * the file fails) it falls back to a typographic monogram — never an
 * invented emblem.
 */
export function CenterLogo({ center, size = 44, className, decorative = true, eager = false }: Props) {
  const [failed, setFailed] = useState(false);
  // two radii in the system: small marks get the control radius, large ones the surface radius
  const style = { '--logo-size': `${size}px`, '--logo-radius': size >= 56 ? 'var(--radius-lg)' : 'var(--radius-sm)' } as CSSProperties;

  if (center.logo && !failed) {
    return (
      <span className={cn(s.tile, className)} style={style}>
        <img
          className={s.image}
          src={center.logo}
          width={size}
          height={size}
          alt={decorative ? '' : fill(t.common.logoOf, { name: center.name })}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span className={cn(s.tile, s.monogram, className)} style={style} aria-hidden={decorative || undefined}>
      {monogram(center.name)}
    </span>
  );
}
