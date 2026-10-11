import { districtText } from '@/i18n';
import { distanceKm } from '@/lib/geo';
import type { District, DistrictId, LngLat } from './types';

/**
 * Orientation areas of Samarkand used for filtering.
 *
 * Each area is named after streets and places people use to describe a
 * location («на Гагарина», «у вокзала») and anchored on a real point there.
 * There are no drawn borders: a centre belongs to the area whose anchor is
 * nearest.
 */
type Spec = Omit<District, 'label' | 'landmarks'>;

const SPECS: Spec[] = [
  {
    id: 'center',
    anchor: { lat: 39.6552, lng: 66.9589 },
    keywords: ['в центре', 'центр города', 'центре', 'шахруха', 'навои', 'navoiy', 'shahar markazi', 'city centre', 'city center', 'downtown'],
  },
  {
    id: 'university',
    anchor: { lat: 39.64583, lng: 66.96186 },
    keywords: ['бульвар', 'университетский', 'универ', 'самгу', 'universitet', 'bulvar', 'universitet xiyoboni', 'samdu', 'university boulevard'],
  },
  {
    id: 'gagarin',
    anchor: { lat: 39.65789, lng: 66.93653 },
    keywords: ['гагарина', 'гагарин', 'мирзо улугбека', 'улугбека', 'gagarin', "ulug'bek", 'ulugbek', "gagarin ko'chasi"],
  },
  {
    id: 'west',
    anchor: { lat: 39.64579, lng: 66.927 },
    keywords: ['запад', 'западе', 'согдиана', 'согдиане', 'буюк ипак', 'ипак йули', "so'g'diyona", 'sogdiyona', 'sogdiana', 'west'],
  },
  {
    id: 'afrasiab',
    anchor: { lat: 39.66812, lng: 66.97462 },
    keywords: ['дахбед', 'дахбедская', 'дагбитская', 'рудаки', 'ибн сины', 'афрасиаб', 'afrosiyob', 'daxbet', 'dahbed', 'rudakiy', 'dagbit', 'rudaki'],
  },
  {
    id: 'station',
    anchor: { lat: 39.68596, lng: 66.929 },
    keywords: ['вокзал', 'вокзала', 'беруни', 'vokzal', 'temir yo\'l', 'railway station', 'station'],
  },
  {
    id: 'old-city',
    anchor: { lat: 39.6547, lng: 66.9757 },
    keywords: ['регистан', 'регистана', 'старый город', 'айни', 'registon', 'registon', 'registan', 'old town', 'eski shahar'],
  },
  {
    id: 'south',
    anchor: { lat: 39.625, lng: 66.96 },
    keywords: ['юг', 'южнее', 'самаркандский район', 'janub', 'south'],
  },
];

/** Names and landmarks follow the interface language */
export const DISTRICTS: District[] = SPECS.map((spec) => ({
  ...spec,
  get label() {
    return districtText(spec.id).label;
  },
  get landmarks() {
    return districtText(spec.id).landmarks;
  },
}));

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<DistrictId, District>;

export const isDistrictId = (v: string): v is DistrictId => v in DISTRICT_BY_ID;

/** The area whose anchor is closest to a point */
export function districtFor(location: LngLat): DistrictId {
  let best = DISTRICTS[0]!;
  let bestKm = Infinity;
  for (const d of DISTRICTS) {
    const km = distanceKm(location, d.anchor);
    if (km < bestKm) {
      bestKm = km;
      best = d;
    }
  }
  return best.id;
}
