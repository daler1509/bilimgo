import { Skeleton } from '@/components/ui/Skeleton';
import s from './CenterCard.module.css';

/** Mirrors CenterCard geometry so loading → loaded causes no layout shift. */
export function CenterCardSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className={`${s.card} ${compact ? s.compact : ''}`} aria-hidden="true">
      <div className={s.media}>
        <Skeleton width="100%" height="100%" radius={0} />
      </div>
      <div className={s.body}>
        <div className={s.head}>
          <Skeleton width="62%" height={16} style={{ marginTop: 3 }} />
          <Skeleton width="44%" height={12} style={{ marginTop: 10 }} />
        </div>
        <div className={s.facts}>
          <Skeleton width="58%" height={11} style={{ marginBlock: 2 }} />
          <Skeleton width="36%" height={11} style={{ marginBlock: 2 }} />
        </div>
        <div className={s.footer}>
          <Skeleton width="100%" height={40} radius={8} />
          <Skeleton width="100%" height={40} radius={8} />
        </div>
      </div>
    </div>
  );
}
