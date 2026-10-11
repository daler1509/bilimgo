import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { GeoBounds, LngLat } from '@/data/types';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapMarkerData {
  id: string;
  location: LngLat;
  /** Short name shown on hover / selection */
  label: string;
  ariaLabel?: string;
  icon?: LucideIcon;
  /** Context markers: visible but outside the current result set */
  muted?: boolean;
}

export interface MapViewState {
  center: LngLat;
  /** Yandex zoom level (256 px tiles) */
  zoom: number;
  bounds: GeoBounds;
}

/** Imperative API, mirroring what map SDKs expose. */
export interface MapViewHandle {
  flyTo(location: LngLat, zoom?: number): void;
  flyToMarker(id: string, zoom?: number): void;
  fitMarkers(ids?: string[]): void;
  zoomBy(delta: number): void;
  getState(): MapViewState | null;
}

/**
 * full — the map owns every gesture (Search, Map pages).
 * cooperative — embedded in a scrolling page: no wheel zoom; on touch
 *   screens the map doesn't capture swipes and a tap opens `openHref`.
 */
export type MapGestures = 'full' | 'cooperative';

export interface MapViewProps {
  markers: MapMarkerData[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onMarkerClick?: (id: string) => void;
  onMarkerHover?: (id: string | null) => void;
  onBackgroundClick?: () => void;
  /** Fired when the camera settles */
  onViewChange?: (view: MapViewState, meta: { user: boolean }) => void;
  /** Without it the map frames all markers once they arrive */
  initialView?: { center: LngLat; zoom: number } | null;
  /** Points to frame first instead of every marker (e.g. the dense core of the city) */
  frame?: LngLat[];
  gestures?: MapGestures;
  /** Where a tap leads when the map is not interactive (touch + cooperative) */
  openHref?: string;
  /** Show the «Открыть карту» label on that tap area (hide when the page has its own link) */
  openHint?: boolean;
  /** Area covered by UI (bottom sheet, panels) — keeps content visible */
  insets?: Partial<Insets>;
  controls?: { zoom?: boolean; locate?: boolean; fit?: boolean };
  controlsPlacement?: 'top-right' | 'bottom-right';
  onSearchArea?: (bounds: GeoBounds) => void;
  /** Card attached to a marker (desktop preview) */
  popup?: { id: string; content: ReactNode } | null;
  /** Pan to the selected marker when it is out of view */
  followSelection?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
}
