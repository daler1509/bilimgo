import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl, type ExpressionSpecification, type MapLibreEvent } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, LocateFixed, Maximize2, Minus, Plus } from 'lucide-react';
import type { GeoBounds, LngLat } from '@/data/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { locale, t } from '@/i18n';
import { cn } from '@/lib/cn';
import {
  CITY_CENTER,
  DEFAULT_ZOOM,
  FIT_MAX_ZOOM,
  isInCity,
  mapAttribution,
  mapLocale,
  mapStyleUrl,
  MAX_BOUNDS,
  MAX_ZOOM,
  mercator,
  MIN_ZOOM,
} from '@/map/mapConfig';
import { getTheme, useTheme } from '@/state/theme';
import { useUi } from '@/state/ui';
import { clusterPoints, mergeOverlaps, quantizeZoom, type ClusterInput } from './cluster';
import { MapUnavailable } from './MapUnavailable';
import { CenterPin, ClusterBubble, MutedDot, UserDot } from './MapMarkers';
import type { Insets, MapMarkerData, MapViewHandle, MapViewProps, MapViewState } from './types';
import s from './MapView.module.css';

setWorkerUrl(workerUrl);

type Positioned = ClusterInput & { marker: MapMarkerData };

/** One element the map positions for us */
interface Slot {
  key: string;
  location: LngLat;
  zIndex: number;
  content: ReactNode;
  /** What activating the element does */
  action: { type: 'select'; id: string } | { type: 'fit'; points: LngLat[] } | null;
  hoverId?: string;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration = (ms: number) => (reducedMotion() ? 0 : ms);
/** Merge radius in screen px — tighter on phones so the map stays readable */
const clusterRadius = (width: number) => (width < 520 ? 38 : 46);
/** Clustering works on quarter-octave zoom steps so groups don't flicker */
const stepOf = (zoom: number) => quantizeZoom(2 ** zoom);

/** Night palette for the hosted dark style: our navy instead of near-black, readable labels */
const DARK_PAINT: Record<string, [string, string][]> = {
  background: [['background-color', '#0f1a28']],
  water: [['fill-color', '#0d2a38']],
  waterway: [['line-color', '#0d2a38']],
  landuse_residential: [['fill-color', '#122030']],
  landcover_wood: [['fill-color', '#11251f']],
  landuse_park: [['fill-color', '#11251f']],
  building: [['fill-color', '#18263a']],
  'aeroway-area': [['fill-color', '#132032']],
  'aeroway-runway': [['line-color', '#1f2e43']],
  highway_path: [['line-color', '#1c2a3c']],
  highway_minor: [['line-color', '#1f2e43']],
  highway_major_casing: [['line-color', 'rgba(74, 96, 124, 0.8)']],
  highway_major_inner: [['line-color', '#26384f']],
  highway_major_subtle: [['line-color', '#26384f']],
  highway_motorway_casing: [['line-color', 'rgba(84, 108, 138, 0.8)']],
  highway_motorway_inner: [['line-color', '#2e4462']],
  highway_motorway_subtle: [['line-color', '#26384f']],
  railway: [['line-color', '#2a3a50']],
  railway_minor: [['line-color', '#2a3a50']],
  railway_transit: [['line-color', '#2a3a50']],
};

/** Map labels in the visitor's language where OpenStreetMap has a name in it */
const NAME_FIELD: Record<typeof locale, ExpressionSpecification> = {
  ru: ['coalesce', ['get', 'name:ru'], ['get', 'name']],
  uz: ['coalesce', ['get', 'name:uz'], ['get', 'name:latin'], ['get', 'name']],
  en: ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']],
};

/**
 * Adapts the hosted OpenStreetMap style to Samarkand:
 * - names in the interface language where OpenStreetMap has them, local
 *   names otherwise;
 * - US highway shields removed (irrelevant here), and roads without a
 *   reference number no longer trip the shield filter;
 * - in the dark theme, the near-black hosted palette is recoloured to the
 *   site's night navy and labels get enough contrast to read.
 */
function tuneStyle(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id === 'highway-shield-us-interstate' || layer.id === 'road_shield_us') {
      map.removeLayer(layer.id);
      continue;
    }
    if (layer.type !== 'symbol') continue;
    const filter = map.getFilter(layer.id);
    if (filter && JSON.stringify(filter).includes('["get","ref_length"]')) {
      const safe = JSON.parse(JSON.stringify(filter).split('["get","ref_length"]').join('["coalesce",["get","ref_length"],99]'));
      map.setFilter(layer.id, safe);
    }
    const field = map.getLayoutProperty(layer.id, 'text-field');
    if (!field || !JSON.stringify(field).includes('name')) continue;
    map.setLayoutProperty(layer.id, 'text-field', NAME_FIELD[locale]);
  }
  if (getTheme() !== 'dark') return;
  for (const layer of map.getStyle().layers ?? []) {
    for (const [prop, value] of DARK_PAINT[layer.id] ?? []) map.setPaintProperty(layer.id, prop as 'fill-color', value);
    if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'text-field')) {
      const road = layer.id.startsWith('highway_name');
      map.setPaintProperty(layer.id, 'text-color', layer.id === 'water_name' ? '#6fb4cf' : road ? '#8496ad' : '#a9b8c9');
      map.setPaintProperty(layer.id, 'text-halo-color', '#0f1a28');
      map.setPaintProperty(layer.id, 'text-halo-width', 1.2);
    }
  }
}

/**
 * The map: MapLibre GL with OpenStreetMap vector tiles (OpenFreeMap) and
 * BilimGo's own markers, clusters, preview card and controls — the city is
 * real, the look stays in the design system.
 */
export const MapLibreMapView = forwardRef<MapViewHandle, MapViewProps>(function MapLibreMapView(
  {
    markers,
    selectedId,
    hoveredId,
    onMarkerClick,
    onMarkerHover,
    onBackgroundClick,
    onViewChange,
    initialView,
    frame,
    gestures = 'full',
    openHref,
    openHint = true,
    insets: insetsProp,
    controls = { zoom: true, locate: true, fit: true },
    controlsPlacement = 'top-right',
    onSearchArea,
    popup,
    followSelection = true,
    className,
    ariaLabel = t.map.label,
    children,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const entities = useRef(new Map<string, Marker>());
  const elements = useRef(new Map<string, HTMLElement>());

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [zoomStep, setZoomStep] = useState(() => stepOf(initialView?.zoom ?? DEFAULT_ZOOM));
  const [areaDirty, setAreaDirty] = useState(false);
  const [userLocation, setUserLocation] = useState<LngLat | null>(null);
  const [width, setWidth] = useState(0);
  const coarse = useMediaQuery('(pointer: coarse)');
  const theme = useTheme();
  const { toast } = useUi();

  const staticOnTouch = gestures === 'cooperative' && coarse;
  const insets: Insets = { ...NO_INSETS, ...insetsProp };
  const insetsKey = `${insets.top}|${insets.right}|${insets.bottom}|${insets.left}`;

  /* ---------- latest props for callbacks registered once ---------- */
  const live = useRef({ onViewChange, onBackgroundClick, onMarkerClick, onMarkerHover, canSearchArea: !!onSearchArea, selectedId, insets });
  live.current = { onViewChange, onBackgroundClick, onMarkerClick, onMarkerHover, canSearchArea: !!onSearchArea, selectedId, insets };

  /** Camera and the part of the map not covered by UI */
  const stateOf = useCallback((map: MapLibreMap): MapViewState => {
    const c = map.getCenter();
    const { top = 0, right = 0, bottom = 0, left = 0 } = map.getPadding();
    const canvas = map.getCanvas();
    const nw = map.unproject([left, top]);
    const se = map.unproject([canvas.clientWidth - right, canvas.clientHeight - bottom]);
    return { center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom(), bounds: [nw.lng, se.lat, se.lng, nw.lat] as GeoBounds };
  }, []);

  /* ---------- camera helpers ---------- */
  const flyTo = useCallback((location: LngLat, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [location.lng, location.lat], zoom: zoom ?? map.getZoom(), duration: duration(600) });
  }, []);

  const fitTo = useCallback((points: LngLat[], animate = true) => {
    const map = mapRef.current;
    if (!map || !points.length) return;
    const bounds = new LngLatBounds();
    points.forEach((p) => bounds.extend([p.lng, p.lat]));
    /* a fixed 56px would eat a third of a phone-sized map; the top keeps room for pin heads */
    const container = map.getContainer();
    const pad = Math.round(Math.min(56, Math.max(24, Math.min(container.clientWidth, container.clientHeight) * 0.1)));
    map.fitBounds(bounds, {
      padding: { top: pad + 12, bottom: pad, left: pad, right: pad },
      maxZoom: FIT_MAX_ZOOM,
      duration: animate ? duration(600) : 0,
    });
  }, []);

  /* ---------- where things are on screen (DOM measurement) ---------- */
  const screenPoint = useCallback((key: string) => {
    const el = elements.current.get(key);
    const root = rootRef.current;
    if (!el || !root || !el.isConnected) return null;
    const anchor = (el.querySelector('[data-anchor]') as HTMLElement | null) ?? el;
    const r = anchor.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height - box.top, width: box.width, height: box.height };
  }, []);

  const placeFrame = useRef(0);
  const placePopup = useCallback(() => {
    cancelAnimationFrame(placeFrame.current);
    placeFrame.current = requestAnimationFrame(() => {
      const node = popupRef.current;
      const id = live.current.selectedId;
      if (!node || !id) return;
      const p = screenPoint(id);
      if (!p) {
        node.style.visibility = 'hidden';
        return;
      }
      const { top } = live.current.insets;
      const w = node.offsetWidth || 320;
      const h = node.offsetHeight || 260;
      const x = Math.min(Math.max(12, p.x - w / 2), Math.max(12, p.width - w - 12));
      // above the pin (its head is ~48px tall), or below its name label
      const above = p.y - top > h + 64;
      const y = above ? p.y - h - 58 : p.y + 34;
      node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      node.style.visibility = p.x < -40 || p.x > p.width + 40 || p.y < -40 || p.y > p.height + 40 ? 'hidden' : 'visible';
    });
  }, [screenPoint]);

  /* ---------- create the map ---------- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setStatus('loading');
    const start = initialView ?? { center: CITY_CENTER, zoom: DEFAULT_ZOOM };
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: host,
        style: mapStyleUrl(getTheme()),
        center: [start.center.lng, start.center.lat],
        zoom: start.zoom,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxBounds: MAX_BOUNDS,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        cooperativeGestures: gestures === 'cooperative',
        fadeDuration: reducedMotion() ? 0 : 200,
        locale: mapLocale(),
        // the hosted style is known-good; skipping validation saves time and console noise
        validateStyle: false,
      });
    } catch {
      // no WebGL (old device, disabled GPU) — the rest of the page still works
      setStatus('error');
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.getCanvas().setAttribute('aria-label', ariaLabel);

    let loaded = false;
    const giveUp = window.setTimeout(() => !loaded && setStatus('error'), 20000);
    map.on('style.load', () => tuneStyle(map));
    // a few POI icons are missing from the hosted sprite — draw nothing instead of warning
    map.setMissingStyleImageResolver((id) => {
      if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.on('load', () => {
      loaded = true;
      window.clearTimeout(giveUp);
      setWidth(host.clientWidth);
      setZoomStep(stepOf(map.getZoom()));
      setStatus('ready');
    });
    map.on('error', () => {
      // a missing tile is harmless; failing before the first render is not
      if (!loaded) setStatus('error');
    });
    map.on('move', () => {
      const step = stepOf(map.getZoom());
      setZoomStep((prev) => (prev === step ? prev : step));
      placePopup();
    });
    map.on('movestart', (e: MapLibreEvent) => {
      if (e.originalEvent && live.current.canSearchArea) setAreaDirty(true);
    });
    map.on('moveend', (e: MapLibreEvent) => live.current.onViewChange?.(stateOf(map), { user: !!e.originalEvent }));
    map.on('click', () => live.current.onBackgroundClick?.());
    map.on('resize', () => {
      setWidth(host.clientWidth);
      placePopup();
    });
    mapRef.current = map;

    const liveEntities = entities.current;
    return () => {
      window.clearTimeout(giveUp);
      cancelAnimationFrame(placeFrame.current);
      liveEntities.forEach((m) => m.remove());
      liveEntities.clear();
      map.remove();
      mapRef.current = null;
    };
    // the map instance lives for the component's lifetime (or until a retry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  /* ---------- theme switch: same map, the other basemap; DOM markers stay ---------- */
  const styledFor = useRef(getTheme());
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || styledFor.current === theme) return;
    styledFor.current = theme;
    map.setStyle(mapStyleUrl(theme));
  }, [theme, status]);

  /* ---------- gestures: embedded maps on touch screens stay still ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlers = [map.dragPan, map.scrollZoom, map.touchZoomRotate, map.doubleClickZoom, map.keyboard, map.boxZoom];
    handlers.forEach((h) => (staticOnTouch ? h.disable() : h.enable()));
    if (!staticOnTouch) map.touchZoomRotate.disableRotation();
  }, [staticOnTouch, status]);

  /* ---------- UI covering the map (sheet, panels) ---------- */
  useEffect(() => {
    mapRef.current?.setPadding(insets);
    placePopup();
    // insetsKey captures the values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetsKey, status]);

  /* ---------- markers & clusters ---------- */
  const active = useMemo(() => markers.filter((m) => !m.muted), [markers]);
  const muted = useMemo(() => markers.filter((m) => m.muted), [markers]);
  const positioned = useMemo<Positioned[]>(() => active.map((m) => ({ id: m.id, world: mercator(m.location), marker: m })), [active]);

  const nodes = useMemo(() => {
    const radius = clusterRadius(width || 800);
    return mergeOverlaps(clusterPoints(positioned, zoomStep, radius, selectedId), zoomStep, selectedId);
  }, [positioned, zoomStep, width, selectedId]);

  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = muted.map((m) => ({ key: `muted:${m.id}`, location: m.location, zIndex: 1, content: <MutedDot />, action: null }));
    for (const node of nodes) {
      if (node.kind === 'cluster') {
        const points = node.items.map((i) => i.marker.location);
        out.push({
          key: node.key,
          location: { lat: points.reduce((a, p) => a + p.lat, 0) / points.length, lng: points.reduce((a, p) => a + p.lng, 0) / points.length },
          zIndex: 3,
          action: { type: 'fit', points },
          content: (
            <ClusterBubble
              count={node.items.length}
              highlighted={node.items.some((i) => i.id === hoveredId)}
              label={`${node.items.length} ${t.map.cluster}`}
            />
          ),
        });
      } else {
        const m = node.item.marker;
        const isSelected = selectedId === m.id;
        const isHovered = hoveredId === m.id;
        out.push({
          key: m.id,
          location: m.location,
          zIndex: isSelected ? 6 : isHovered ? 5 : 2,
          action: { type: 'select', id: m.id },
          hoverId: m.id,
          content: <CenterPin marker={m} selected={isSelected} hovered={isHovered} />,
        });
      }
    }
    if (userLocation) out.push({ key: 'user', location: userLocation, zIndex: 4, content: <UserDot />, action: null });
    return out;
  }, [muted, nodes, hoveredId, selectedId, userLocation]);

  /* Elements are created once per key and handed to the map. Events are
     listened to natively on them so a marker click never reaches the map
     (which would read it as «clicked the background»). */
  const actions = useRef(new Map<string, Slot['action']>());
  const hoverIds = useRef(new Map<string, string | undefined>());
  actions.current = new Map(slots.map((sl) => [sl.key, sl.action]));
  hoverIds.current = new Map(slots.map((sl) => [sl.key, sl.hoverId]));

  const activate = useCallback(
    (key: string) => {
      const action = actions.current.get(key);
      if (!action) return;
      if (action.type === 'select') live.current.onMarkerClick?.(action.id);
      else fitTo(action.points);
    },
    [fitTo],
  );

  const elementFor = (key: string) => {
    let el = elements.current.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = s.slot!;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        activate(key);
      });
      el.addEventListener('dblclick', (e) => e.stopPropagation());
      el.addEventListener('pointerenter', (e) => {
        const id = hoverIds.current.get(key);
        if (e.pointerType === 'mouse' && id) live.current.onMarkerHover?.(id);
      });
      el.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse' && hoverIds.current.get(key)) live.current.onMarkerHover?.(null);
      });
      elements.current.set(key, el);
    }
    return el;
  };

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    const want = new Set(slots.map((sl) => sl.key));
    for (const [key, marker] of entities.current) {
      if (!want.has(key)) {
        marker.remove();
        entities.current.delete(key);
        elements.current.delete(key);
      }
    }
    /* New places appear rather than pop: while the map is still they rise in a
       ripple from the middle of the view; during a pan or zoom (clusters
       splitting) they just fade in quickly. */
    const settled = !map.isMoving() && !reducedMotion();
    const middle = map.getCanvas();
    const cx = middle.clientWidth / 2;
    const cy = middle.clientHeight / 2;
    for (const slot of slots) {
      const lngLat: [number, number] = [slot.location.lng, slot.location.lat];
      let marker = entities.current.get(slot.key);
      if (marker) marker.setLngLat(lngLat);
      else {
        const el = elementFor(slot.key);
        marker = new Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
        entities.current.set(slot.key, marker);
        if (!reducedMotion()) {
          const p = map.project(lngLat);
          const delay = settled ? Math.min(420, Math.hypot(p.x - cx, p.y - cy) * 0.6) : 0;
          el.dataset.enter = settled ? 'ripple' : 'quick';
          el.style.setProperty('--enter-delay', `${Math.round(delay)}ms`);
          el.addEventListener('animationend', () => delete el.dataset.enter, { once: true });
        }
      }
      marker.getElement().style.zIndex = String(slot.zIndex);
    }
    placePopup();
    // elementFor is stable in behaviour (keyed cache)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, status, activate, placePopup]);

  // frame all places as soon as they arrive, unless a view was requested
  const fitted = useRef(!!initialView);
  useEffect(() => {
    if (fitted.current || status !== 'ready' || !active.length) return;
    fitted.current = true;
    fitTo(frame?.length ? frame : active.map((m) => m.location), false);
    // the first framing only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, active, fitTo]);

  /* ---------- keep the selected marker in view ---------- */
  useEffect(() => {
    if (!followSelection || !selectedId || status !== 'ready') return;
    const target = markers.find((m) => m.id === selectedId);
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      const p = screenPoint(selectedId);
      const pad = 56;
      const inView =
        !!p && p.x > insets.left + pad && p.x < p.width - insets.right - pad && p.y > insets.top + pad && p.y < p.height - insets.bottom - pad;
      if (!inView) flyTo(target.location);
    });
    return () => cancelAnimationFrame(frame);
    // react to selection changes only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, status]);

  useLayoutEffect(() => {
    if (popup) placePopup();
  }, [popup, placePopup]);

  /* Esc clears the selection — markers don't take focus on click, so listen
     on the window while something is selected (dialogs handle Esc themselves) */
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return;
      live.current.onBackgroundClick?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  /* ---------- imperative API ---------- */
  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (map) map.easeTo({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, map.getZoom() + delta)), duration: duration(250) });
  }, []);

  useImperativeHandle(
    ref,
    (): MapViewHandle => ({
      flyTo,
      flyToMarker: (id, zoom) => {
        const m = markers.find((x) => x.id === id);
        if (m) flyTo(m.location, zoom);
      },
      fitMarkers: (ids) => fitTo((ids ? markers.filter((m) => ids.includes(m.id)) : active).map((m) => m.location)),
      zoomBy,
      getState: () => (mapRef.current ? stateOf(mapRef.current) : null),
    }),
    [active, fitTo, flyTo, markers, stateOf, zoomBy],
  );

  /* ---------- controls ---------- */
  const locate = () => {
    if (!navigator.geolocation) return toast(t.map.geoDenied);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here: LngLat = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (isInCity(here)) {
          setUserLocation(here);
          flyTo(here, Math.max(mapRef.current?.getZoom() ?? 14, 14.5));
        } else {
          setUserLocation(null);
          toast(t.map.outsideCity);
          flyTo(CITY_CENTER, 13);
        }
      },
      () => toast(t.map.geoDenied),
      { timeout: 8000, maximumAge: 60_000 },
    );
  };

  const showAll = () => fitTo((active.length ? active : markers).map((m) => m.location));

  const ready = status === 'ready';
  const controlStyle =
    controlsPlacement === 'top-right' ? { top: insets.top + 12, right: insets.right + 12 } : { bottom: insets.bottom + 40, right: insets.right + 12 };

  return (
    <div ref={rootRef} className={cn(s.root, className)} data-status={status}>
      <div ref={hostRef} className={s.canvas} role="region" aria-label={ariaLabel} />

      {ready && slots.map((slot) => createPortal(slot.content, elementFor(slot.key), slot.key))}

      {status === 'loading' && <div className={s.loading} aria-hidden="true" />}

      {status === 'error' && (
        <MapUnavailable
          center={selectedId ? (markers.find((m) => m.id === selectedId)?.location ?? CITY_CENTER) : CITY_CENTER}
          onRetry={() => setAttempt((n) => n + 1)}
          compact={gestures === 'cooperative'}
        />
      )}

      {ready && staticOnTouch && openHref && (
        <Link className={s.tapShield} to={openHref} aria-label={t.map.open}>
          {openHint && <span className={s.tapHint}>{t.map.open}</span>}
        </Link>
      )}

      <div className={s.overlay}>
        {ready && onSearchArea && areaDirty && (
          <div className={s.searchArea} style={{ top: insets.top + 12 }}>
            <button
              type="button"
              className={s.searchAreaButton}
              onClick={() => {
                const map = mapRef.current;
                if (!map) return;
                setAreaDirty(false);
                onSearchArea(stateOf(map).bounds);
              }}
            >
              <Crosshair size={16} aria-hidden="true" />
              {t.map.searchArea}
            </button>
          </div>
        )}

        {ready && !staticOnTouch && (controls.zoom || controls.locate || controls.fit) && (
          <div className={s.controls} style={controlStyle}>
            {controls.zoom && (
              <div className={s.controlGroup}>
                <button type="button" className={s.control} onClick={() => zoomBy(1)} aria-label={t.map.zoomIn} title={t.map.zoomIn}>
                  <Plus size={18} />
                </button>
                <button type="button" className={s.control} onClick={() => zoomBy(-1)} aria-label={t.map.zoomOut} title={t.map.zoomOut}>
                  <Minus size={18} />
                </button>
              </div>
            )}
            {(controls.locate || controls.fit) && (
              <div className={s.controlGroup}>
                {controls.locate && (
                  <button type="button" className={s.control} onClick={locate} aria-label={t.map.locate} title={t.map.locate}>
                    <LocateFixed size={18} />
                  </button>
                )}
                {controls.fit && (
                  <button type="button" className={s.control} onClick={showAll} aria-label={t.map.fit} title={t.map.fit}>
                    <Maximize2 size={17} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {ready && popup && popup.id === selectedId && (
          <div ref={popupRef} className={s.popup} style={{ visibility: 'hidden' }}>
            {popup.content}
          </div>
        )}

        {children}

        {ready && (
          <p className={s.attribution}>
            {mapAttribution().map((a, i) => (
              <span key={a.url}>
                {i > 0 && ', '}
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.label}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
});
