import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import markUrl from '@/assets/brand/bilimgo-mark.webp';
import wordmarkUrl from '@/assets/brand/bilimgo-wordmark.webp';
import wordmarkDarkUrl from '@/assets/brand/bilimgo-wordmark-dark.webp';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import s from './Logo.module.css';

/*
 * Both parts are cut from the original logo (src/assets/brand/bilimgo-logo-original.png)
 * without redrawing. Only the height is set; the width follows the file's own
 * proportions, so the logo is never stretched.
 */
const MARK = { width: 158, height: 192 };
const WORDMARK = { width: 440, height: 96 };

export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  return <img src={markUrl} alt="" width={MARK.width} height={MARK.height} className={cn(s.mark, className)} style={{ height: size }} draggable={false} />;
}

interface LogoProps {
  size?: number;
  to?: string;
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ size = 30, to = '/', showWordmark = true, className }: LogoProps) {
  const content = (
    <>
      <LogoMark size={size} />
      {showWordmark && (
        <>
          <img src={wordmarkUrl} alt="" width={WORDMARK.width} height={WORDMARK.height} className={cn(s.wordmark, s.onLight)} draggable={false} />
          {/* the same file with «Bilim» recoloured to read on the dark theme */}
          <img src={wordmarkDarkUrl} alt="" width={WORDMARK.width} height={WORDMARK.height} className={cn(s.wordmark, s.onDark)} draggable={false} />
        </>
      )}
    </>
  );
  const style = { '--logo-h': `${size}px` } as CSSProperties;
  return to ? (
    <Link to={to} className={cn(s.logo, className)} style={style} aria-label={t.brand.home}>
      {content}
    </Link>
  ) : (
    <span className={cn(s.logo, className)} style={style} role="img" aria-label="BilimGo">
      {content}
    </span>
  );
}
