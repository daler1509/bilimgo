import { Skeleton } from '@/components/ui/Skeleton';
import s from './CenterCard.module.css';

/** Mirrors CenterCard geometry so loading → loaded causes no layout shift. */
export function CenterCardSkeleton({ compact }: { compact?: boolean }) {
  const logo = compact ? 44 : 48;
  return (
    <div className={`${s.card} ${compact ? s.compact : ''}`} aria-hidden="true">
      <div className={s.top}>
        <Skeleton width={logo} height={logo} radius={Math.round(logo * 0.24)} />
        <div className={s.head}>
          <Skeleton width="62%" height={16} style={{ marginTop: 3 }} />
          <Skeleton width="44%" height={12} style={{ marginTop: 10 }} />
        </div>
        <Skeleton width={24} height={24} radius={12} />
      </div>
      <div className={s.facts}>
        <Skeleton width="58%" height={11} style={{ marginBlock: 2 }} />
        <Skeleton width="36%" height={11} style={{ marginBlock: 2 }} />
      </div>
      <div className={s.footer} style={{ height: 38 }}>
        <Skeleton width={84} height={12} />
        <Skeleton width={72} height={12} />
      </div>
    </div>
  );
}
