import { ExternalLink, MapPinOff, RotateCcw } from 'lucide-react';
import type { LngLat } from '@/data/types';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { osmUrl } from '@/map/mapConfig';
import s from './MapView.module.css';

interface Props {
  center: LngLat;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * Shown when the map can't load (offline, blocked tiles, no WebGL).
 * The rest of the page keeps working; the place is still one tap away.
 */
export function MapUnavailable({ center, onRetry, compact }: Props) {
  return (
    <div className={cn(s.unavailable, compact && s.unavailableCompact)} role="status">
      <div className={s.unavailableBody}>
        <span className={s.unavailableIcon} aria-hidden="true">
          <MapPinOff size={compact ? 18 : 20} />
        </span>
        <p className={s.unavailableTitle}>{t.map.unavailableTitle}</p>
        {!compact && <p className={s.unavailableText}>{t.map.unavailableText}</p>}
        <div className={s.unavailableActions}>
          {onRetry && (
            <button type="button" className={s.unavailableButton} onClick={onRetry}>
              <RotateCcw size={15} aria-hidden="true" />
              {t.results.retry}
            </button>
          )}
          <a className={s.unavailableButton} href={osmUrl(center, 14)} target="_blank" rel="noopener noreferrer">
            {t.map.openOsm}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
