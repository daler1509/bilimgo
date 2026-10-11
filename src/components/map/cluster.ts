import type { Point } from '@/lib/geo';

export interface ClusterInput {
  id: string;
  world: Point;
}

export type ClusterNode<T extends ClusterInput> =
  | { kind: 'point'; key: string; item: T; world: Point }
  | { kind: 'cluster'; key: string; items: T[]; world: Point };

/**
 * Greedy screen-space clustering (same idea as supercluster, sized for a
 * few hundred points). Runs at a quantised zoom so membership only changes
 * at discrete steps — clusters don't flicker during a smooth zoom.
 *
 * `keepApart` ids (selected marker) are never merged into a cluster.
 */
export function clusterPoints<T extends ClusterInput>(items: T[], zoom: number, radiusPx: number, keepApart?: string | null): ClusterNode<T>[] {
  const r = radiusPx / zoom; // radius in world km
  const cell = r;
  const grid = new Map<string, T[]>();
  const keyOf = (p: Point) => `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;

  for (const it of items) {
    if (it.id === keepApart) continue;
    const k = keyOf(it.world);
    const bucket = grid.get(k);
    if (bucket) bucket.push(it);
    else grid.set(k, [it]);
  }

  const claimed = new Set<string>();
  const out: ClusterNode<T>[] = [];
  // deterministic order: north → south, then west → east
  const ordered = [...items].sort((a, b) => a.world.y - b.world.y || a.world.x - b.world.x);

  for (const it of ordered) {
    if (claimed.has(it.id)) continue;
    if (it.id === keepApart) {
      claimed.add(it.id);
      out.push({ kind: 'point', key: it.id, item: it, world: it.world });
      continue;
    }
    const cx = Math.floor(it.world.x / cell);
    const cy = Math.floor(it.world.y / cell);
    const members: T[] = [it];
    claimed.add(it.id);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (claimed.has(other.id)) continue;
          if (Math.hypot(other.world.x - it.world.x, other.world.y - it.world.y) <= r) {
            members.push(other);
            claimed.add(other.id);
          }
        }
      }
    }
    if (members.length === 1) out.push({ kind: 'point', key: it.id, item: it, world: it.world });
    else {
      const world = {
        x: members.reduce((s, m) => s + m.world.x, 0) / members.length,
        y: members.reduce((s, m) => s + m.world.y, 0) / members.length,
      };
      const key = `c:${members
        .map((m) => m.id)
        .sort()
        .join('|')}`;
      out.push({ kind: 'cluster', key, items: members, world });
    }
  }
  return out;
}

/** Diameter of a cluster bubble in px — shared with ClusterMarker */
export const clusterSizePx = (count: number) => Math.min(50, 30 + Math.round(Math.log2(count + 1) * 6));
const PIN_FOOTPRINT_PX = 30;

const footprint = <T extends ClusterInput>(n: ClusterNode<T>) => (n.kind === 'cluster' ? clusterSizePx(n.items.length) : PIN_FOOTPRINT_PX);
const membersOf = <T extends ClusterInput>(n: ClusterNode<T>): T[] => (n.kind === 'cluster' ? n.items : [n.item]);

/**
 * Second pass: bubbles grow with their count, so two clusters can still
 * overlap on screen. Merge anything whose footprints touch, repeatedly,
 * until every bubble has room — dense city centres stay legible.
 */
export function mergeOverlaps<T extends ClusterInput>(nodes: ClusterNode<T>[], zoom: number, keepApart?: string | null, gapPx = 6): ClusterNode<T>[] {
  const out = [...nodes];
  for (let changed = true; changed; ) {
    changed = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!;
        const b = out[j]!;
        if (a.kind === 'point' && a.item.id === keepApart) continue;
        if (b.kind === 'point' && b.item.id === keepApart) continue;
        const px = Math.hypot(a.world.x - b.world.x, a.world.y - b.world.y) * zoom;
        if (px >= (footprint(a) + footprint(b)) / 2 + gapPx) continue;
        const items = [...membersOf(a), ...membersOf(b)];
        const world = {
          x: items.reduce((s, m) => s + m.world.x, 0) / items.length,
          y: items.reduce((s, m) => s + m.world.y, 0) / items.length,
        };
        const key = `c:${items
          .map((m) => m.id)
          .sort()
          .join('|')}`;
        out.splice(j, 1);
        out[i] = { kind: 'cluster', key, items, world };
        changed = true;
        break outer;
      }
    }
  }
  return out;
}

/** Quarter-octave zoom steps for stable clustering */
export const quantizeZoom = (z: number) => Math.pow(2, Math.round(Math.log2(z) * 4) / 4);
