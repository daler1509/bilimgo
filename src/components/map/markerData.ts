import { DISTRICT_BY_ID } from '@/data/districts';
import type { Center } from '@/data/types';
import { CATEGORY_ICON, GENERIC_ICON } from '@/components/centers/categoryIcons';
import { categoryLine, primaryCategory } from '@/components/centers/centerText';
import type { MapMarkerData } from './types';

interface Options {
  /** Places outside the current result set — drawn as context dots */
  mutedIds?: Set<string>;
}

/** Centers → map markers. One place that decides how a center looks on the map. */
export function centersToMarkers(centers: Center[], { mutedIds }: Options = {}): MapMarkerData[] {
  return centers.map((c) => {
    const primary = primaryCategory(c);
    return {
      id: c.id,
      location: c.location,
      label: c.name,
      ariaLabel: `${c.name}. ${categoryLine(c, 2)}, ${DISTRICT_BY_ID[c.districtId].label}`,
      icon: primary ? CATEGORY_ICON[primary] : GENERIC_ICON,
      muted: mutedIds?.has(c.id),
    };
  });
}
