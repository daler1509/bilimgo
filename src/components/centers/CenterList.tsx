import type { CSSProperties } from 'react';
import { CloudOff, RotateCcw, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StateMessage } from '@/components/ui/StateMessage';
import type { Center } from '@/data/types';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import type { SearchResult } from '@/state/useCenterSearch';
import { CenterCard } from './CenterCard';
import { CenterCardSkeleton } from './CenterCardSkeleton';
import s from './CenterList.module.css';

interface Props {
  result: SearchResult;
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onResetFilters?: () => void;
  hasFilters?: boolean;
  primaryAction?: 'select' | 'link';
  hrefFor: (c: Center) => string;
  compact?: boolean;
  skeletonCount?: number;
}

/** Results with all their states — one component for desktop panel and sheet. */
export function CenterList({
  result,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onResetFilters,
  hasFilters,
  primaryAction = 'select',
  hrefFor,
  compact,
  skeletonCount = 4,
}: Props) {
  if (result.status === 'loading') {
    return (
      <div className={s.list} aria-busy="true" aria-live="polite">
        <span className="sr-only">{t.results.loading}</span>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <CenterCardSkeleton key={i} compact={compact} />
        ))}
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <StateMessage
        tone="error"
        icon={<CloudOff size={26} />}
        title={t.results.errorTitle}
        text={t.results.errorText}
        actions={
          <Button variant="primary" leading={<RotateCcw size={16} />} onClick={result.retry}>
            {t.results.retry}
          </Button>
        }
      />
    );
  }

  if (!result.items.length) {
    return (
      <StateMessage
        icon={<SearchX size={26} />}
        title={t.results.emptyTitle}
        text={t.results.emptyText}
        actions={
          hasFilters && onResetFilters ? (
            <Button variant="secondary" leading={<RotateCcw size={16} />} onClick={onResetFilters}>
              {t.filters.resetAll}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      {result.isRefreshing && (
        <div className={s.progress} role="status" aria-label={t.results.loading}>
          <div className={s.progressBar} />
        </div>
      )}
      {/* a new answer remounts the list, so its cards come in again one after another */}
      <ul key={result.items.map((c) => c.id).join()} className={cn(s.list, result.isRefreshing && s.refreshing)}>
        {result.items.map((c, i) => (
          <li key={c.id} className={s.item} style={{ '--i': Math.min(i, 8) } as CSSProperties}>
            <CenterCard
              center={c}
              selected={selectedId === c.id}
              highlighted={hoveredId === c.id}
              primaryAction={primaryAction}
              onSelect={onSelect}
              onHover={onHover}
              compact={compact}
              detailsHref={hrefFor(c)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
