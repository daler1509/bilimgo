import type { LngLat } from '@/data/types';
import { t } from '@/i18n';
import type { Theme } from '@/state/theme';

/**
 * Basemap: OpenStreetMap data as vector tiles from OpenFreeMap, drawn by
 * MapLibre GL. Free, no API key, allowed in production. Swapping the
 * provider means changing the style URL and the attribution below.
 */
const STYLE_URL: Record<Theme, string> = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
export const mapStyleUrl = (theme: Theme) => STYLE_URL[theme];

export const mapAttribution = (): { label: string; url: string }[] => [
  { label: 'OpenFreeMap', url: 'https://openfreemap.org' },
  { label: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
  { label: t.map.attributionOsm, url: 'https://www.openstreetmap.org/copyright' },
];

/** Registan — the natural centre of the city */
export const CITY_CENTER: LngLat = { lat: 39.6547, lng: 66.9757 };
/** MapLibre zoom levels (512 px tiles) */
export const DEFAULT_ZOOM = 12.3;
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 18.5;
/** Closest zoom used when framing places */
export const FIT_MAX_ZOOM = 15.5;

/** The camera can't wander far from Samarkand: [[west, south], [east, north]] */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [66.6, 39.45],
  [67.35, 39.9],
];

/** Anything inside counts as "in the city" for the locate button */
export const CITY_BOUNDS = { west: 66.86, south: 39.58, east: 67.07, north: 39.73 };

export const isInCity = (p: LngLat) =>
  p.lng >= CITY_BOUNDS.west && p.lng <= CITY_BOUNDS.east && p.lat >= CITY_BOUNDS.south && p.lat <= CITY_BOUNDS.north;

/**
 * Web Mercator position in zoom-0 pixels of a 512 px world, the unit MapLibre
 * zoom levels use. Only relative distances matter (screen-space clustering).
 */
export function mercator(p: LngLat) {
  const sin = Math.sin((p.lat * Math.PI) / 180);
  return {
    x: ((p.lng + 180) / 360) * 512,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 512,
  };
}

/** MapLibre's own hints in the interface language */
export const mapLocale = (): Record<string, string> => ({
  'CooperativeGesturesHandler.WindowsHelpText': t.map.gestures.windows,
  'CooperativeGesturesHandler.MacHelpText': t.map.gestures.mac,
  'CooperativeGesturesHandler.MobileHelpText': t.map.gestures.mobile,
  'Map.Title': t.map.title,
});

/** The same place in OpenStreetMap — «open in a full map» from fallbacks */
export const osmUrl = (p: LngLat, zoom = 16) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=${Math.round(zoom)}/${p.lat}/${p.lng}`;
