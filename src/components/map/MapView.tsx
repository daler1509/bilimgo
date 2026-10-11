import { forwardRef, lazy, Suspense } from 'react';
import type { MapViewHandle, MapViewProps } from './types';
import s from './MapView.module.css';

/**
 * Public map component. Pages talk to this interface only. The MapLibre
 * engine (~280 KB gzip) loads as a separate chunk, so pages render at once
 * and the map fills in when it's ready.
 */
const MapLibreMapView = lazy(() => import('./MapLibreMapView').then((m) => ({ default: m.MapLibreMapView })));

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(props, ref) {
  return (
    <Suspense
      fallback={
        <div className={`${s.root} ${props.className ?? ''}`} aria-busy="true">
          <div className={s.loading} />
        </div>
      }
    >
      <MapLibreMapView ref={ref} {...props} />
    </Suspense>
  );
});
