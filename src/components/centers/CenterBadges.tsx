import { Award, BadgeCheck, Building2, Flame } from 'lucide-react';
import type { Center } from '@/data/types';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import s from './CenterBadges.module.css';

/**
 * «Лучший выбор» and «Популярно»: both read off the number of ratings on the
 * place's Yandex Maps card (see BEST_PICKS and POPULAR_MIN_RATINGS in the
 * repository). They sit in the photo's corner, one under the other.
 */
export function PlaceBadges({ center, className, row }: { center: Pick<Center, 'best' | 'popular'>; className?: string; row?: boolean }) {
  if (!center.best && !center.popular) return null;
  return (
    <span className={cn(s.stack, row && s.row, className)}>
      {center.best && (
        <span className={cn(s.badge, s.best)} title={t.badges.bestHint}>
          <Award size={13} strokeWidth={2.4} aria-hidden="true" />
          {t.badges.best}
        </span>
      )}
      {center.popular && (
        <span className={cn(s.badge, s.popular)} title={t.badges.popularHint}>
          <Flame size={13} strokeWidth={2.4} aria-hidden="true" />
          {t.badges.popular}
        </span>
      )}
    </span>
  );
}

/** «Проверенные центры»: the catalogue lists only places whose details were checked against their sources */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn(s.badge, s.verified, className)} title={t.data.notice}>
      <BadgeCheck size={14} strokeWidth={2.2} aria-hidden="true" />
      {t.data.short}
    </span>
  );
}

export function NetworkBadge({ center, className }: { center: Pick<Center, 'networkSize'>; className?: string }) {
  if (center.networkSize < 2) return null;
  return (
    <span className={cn(s.badge, s.network, className)} title={t.badges.networkHint}>
      <Building2 size={13} aria-hidden="true" />
      {t.badges.network(center.networkSize)}
    </span>
  );
}
