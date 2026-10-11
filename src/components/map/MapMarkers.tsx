import { memo, type CSSProperties } from 'react';
import { MapPin } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/cn';
import { clusterSizePx } from './cluster';
import type { MapMarkerData } from './types';
import s from './MapView.module.css';

/**
 * Marker visuals. They are rendered into elements owned by the map, so they
 * carry no React event handlers — MapLibreMapView listens on the host element.
 * `data-anchor` marks the exact point on the coordinate.
 */

/** BilimGo pin: rounded head with a soft tip, drawn once as a path. */
const PIN_PATH = 'M16 43 C16 43 3 27.5 3 16.5 A13 13 0 1 1 29 16.5 C29 27.5 16 43 16 43 Z';

interface PinProps {
  marker: MapMarkerData;
  selected?: boolean;
  hovered?: boolean;
}

export const CenterPin = memo(function CenterPin({ marker, selected, hovered }: PinProps) {
  const Icon = marker.icon ?? MapPin;
  return (
    <button
      type="button"
      className={cn(s.markerWrap, hovered && s.hovered, selected && s.selected)}
      data-anchor=""
      aria-label={marker.ariaLabel ?? marker.label}
      aria-pressed={!!selected}
    >
      <span className={s.marker}>
        <svg className={s.pin} viewBox="0 0 32 46" aria-hidden="true">
          <path className={s.pinShape} d={PIN_PATH} />
        </svg>
        {selected ? (
          <span className={s.selectedDot} />
        ) : (
          <span className={s.pinIcon}>
            <Icon size={15} strokeWidth={2.1} />
          </span>
        )}
        {(hovered || selected) && <span className={s.markerLabel}>{marker.label}</span>}
      </span>
    </button>
  );
});

interface ClusterProps {
  count: number;
  highlighted?: boolean;
  label: string;
}

export const ClusterBubble = memo(function ClusterBubble({ count, highlighted, label }: ClusterProps) {
  return (
    <button type="button" className={s.markerWrap} data-anchor="" aria-label={label}>
      <span
        className={cn(s.cluster, highlighted && s.clusterHighlighted)}
        style={{ '--cluster-size': `${clusterSizePx(count)}px` } as CSSProperties}
      >
        {count}
      </span>
    </button>
  );
});

export function MutedDot() {
  return <span className={s.mutedDot} data-anchor="" aria-hidden="true" />;
}

export function UserDot() {
  return (
    <span className={s.userDot} data-anchor="" role="img" aria-label={t.map.you}>
      <span className={s.userPulse} />
    </span>
  );
}
