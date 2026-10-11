import { t } from '@/i18n';
import type { GeoBounds, LngLat } from '@/data/types';

/**
 * Local planar projection: kilometres from Registan, x → east, y → south.
 *
 * Used for distances and «km from Registan». Inside one city it matches
 * Web Mercator closely; everything public (centres, bounds, URL state)
 * stays in lat/lng.
 */
export type Point = { x: number; y: number };

export const ORIGIN: LngLat = { lat: 39.6547, lng: 66.9757 };

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG = 111.32 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export function project(ll: LngLat): Point {
  return {
    x: (ll.lng - ORIGIN.lng) * KM_PER_DEG_LNG,
    y: -(ll.lat - ORIGIN.lat) * KM_PER_DEG_LAT,
  };
}

export function unproject(p: Point): LngLat {
  return {
    lat: ORIGIN.lat - p.y / KM_PER_DEG_LAT,
    lng: ORIGIN.lng + p.x / KM_PER_DEG_LNG,
  };
}

/** Great-circle distance is overkill inside one city; planar is exact enough. */
export function distanceKm(a: LngLat, b: LngLat): number {
  const pa = project(a);
  const pb = project(b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

export function isInBounds(ll: LngLat, [w, s, e, n]: GeoBounds): boolean {
  return ll.lng >= w && ll.lng <= e && ll.lat >= s && ll.lat <= n;
}

/** 650 м, 1,7 км (units and decimal mark follow the interface language) */
export function formatDistance(km: number): string {
  if (km < 0.95) return `${Math.max(100, Math.round((km * 1000) / 50) * 50)} ${t.units.m}`;
  const value = km < 10 ? km.toFixed(1).replace(/\.0$/, '') : String(Math.round(km));
  return `${value.replace('.', t.units.decimal)} ${t.units.km}`;
}

/**
 * The dense core of a set of places: the share closest to their median
 * point. Frames a map on where things are, not on the outliers (a centre
 * out by the airport shouldn't zoom the whole city out).
 */
export function denseCore<T extends { location: LngLat }>(items: T[], share = 0.85): T[] {
  if (items.length < 5) return items;
  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
  const mid: LngLat = { lat: median(items.map((i) => i.location.lat)), lng: median(items.map((i) => i.location.lng)) };
  return [...items]
    .sort((a, b) => distanceKm(a.location, mid) - distanceKm(b.location, mid))
    .slice(0, Math.max(3, Math.ceil(items.length * share)));
}
