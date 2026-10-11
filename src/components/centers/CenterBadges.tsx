import { Building2, Flame } from 'lucide-react';
import type { Center } from '@/data/types';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import s from './CenterBadges.module.css';

/**
 * Facts that set a place apart in a list. Each one comes from the data:
 * «Популярный выбор» from Yandex Maps rating counts (see POPULAR_PICKS),
 * the number of branches from the catalogue itself.
 */
export function PopularBadge({ explain, className }: { explain?: boolean; className?: string }) {
  return (
    <span className={cn(s.badge, s.popular, className)} title={t.badges.popularHint}>
      <Flame size={13} strokeWidth={2.4} aria-hidden="true" />
      {t.badges.popular}
      {explain && <span className="sr-only">: {t.badges.popularHint}</span>}
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
