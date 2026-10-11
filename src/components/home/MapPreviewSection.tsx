import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Map as MapIcon } from 'lucide-react';
import { CenterPreviewCard } from '@/components/centers/CenterPreviewCard';
import { MapView } from '@/components/map/MapView';
import { centersToMarkers } from '@/components/map/markerData';
import type { MapViewHandle } from '@/components/map/types';
import { buttonClass } from '@/components/ui/Button';
import type { Center, DistrictId } from '@/data/types';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { countPlaces, t } from '@/i18n';
import { cn } from '@/lib/cn';
import { denseCore } from '@/lib/geo';
import { useAvailability } from '@/state/useCenterSearch';
import s from './Sections.module.css';

const CORE_SHARE = 0.8;

/**
 * Areas of the city next to the real map. The preview is framed on where the
 * centres are dense; choosing an area frames its places. On phones the map
 * doesn't take gestures — a tap (or the button under it) opens the full map.
 */
export function MapPreviewSection({ centers }: { centers: Center[] }) {
  const mapRef = useRef<MapViewHandle>(null);
  const [area, setArea] = useState<DistrictId | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { counts, districts } = useAvailability();
  const isDesktop = useIsDesktop();

  /* 80% nearest the median: the city core, without the outskirts toward the airport */
  const core = useMemo(() => denseCore(centers, CORE_SHARE).map((c) => c.location), [centers]);
  const markers = useMemo(() => {
    const mutedIds = area ? new Set(centers.filter((c) => c.districtId !== area).map((c) => c.id)) : undefined;
    return centersToMarkers(centers, { mutedIds });
  }, [centers, area]);

  const pick = (id: DistrictId | null) => {
    setArea(id);
    setSelected(null);
    if (id) mapRef.current?.fitMarkers(centers.filter((c) => c.districtId === id).map((c) => c.id));
    else mapRef.current?.fitMarkers(denseCore(centers, CORE_SHARE).map((c) => c.id));
  };

  const selectedCenter = centers.find((c) => c.id === selected) ?? null;
  const mapHref = area ? `/map?d=${area}` : '/map';

  return (
    <section className={s.section} aria-labelledby="map-title">
      <div className="container">
        <h2 className={cn(s.title, s.titleSpaced)} id="map-title">
          {t.home.mapTitle}
        </h2>

        <div className={s.explore}>
          <div className={s.areas} role="group" aria-label={t.home.areas}>
            <button type="button" className={cn(s.area, area === null && s.areaActive)} aria-pressed={area === null} onClick={() => pick(null)}>
              <span className={s.areaName}>{t.home.wholeCity}</span>
              <span className={s.areaCount}>{counts ? countPlaces(counts.total) : ''}</span>
            </button>
            {districts.map((d) => (
              <button key={d.id} type="button" className={cn(s.area, area === d.id && s.areaActive)} aria-pressed={area === d.id} onClick={() => pick(d.id)}>
                <span className={s.areaText}>
                  <span className={s.areaName}>{d.label}</span>
                  <span className={s.areaHint}>{d.landmarks}</span>
                </span>
                <span className={s.areaCount}>{counts ? counts.districts[d.id] ?? 0 : ''}</span>
              </button>
            ))}
          </div>

          <div className={s.mapColumn}>
            <div className={s.mapCard}>
              <MapView
                ref={mapRef}
                markers={markers}
                frame={core}
                selectedId={selected}
                onMarkerClick={setSelected}
                onBackgroundClick={() => setSelected(null)}
                gestures="cooperative"
                openHref={mapHref}
                openHint={false}
                controls={{ zoom: true, fit: false }}
                popup={
                  isDesktop && selectedCenter
                    ? {
                        id: selectedCenter.id,
                        content: <CenterPreviewCard center={selectedCenter} detailsHref={`/centers/${selectedCenter.id}`} onClose={() => setSelected(null)} />,
                      }
                    : null
                }
              />
            </div>
            <Link to={mapHref} className={buttonClass({ variant: 'secondary', size: 'lg', block: true })}>
              <MapIcon size={18} aria-hidden="true" />
              <span>{t.home.openMap}</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
