import type { Completable } from './completeness';
import { supabase } from './supabaseClient';

/** What the admin lists need from a `centers` row: identity, state and the fields that decide completeness */
export interface CenterListRow extends Completable {
  id: string;
  name: string;
  brand: string | null;
  branch: string | null;
  kind: string;
  categories: string[];
  lat: number;
  lng: number;
  published: boolean;
  updated_at: string;
  /** {ru, uz, en} */
  address: Record<string, string> | null;
  teachers: { name: string; role?: Record<string, string> | null; note?: Record<string, string> | null; photo?: { src: string } | null }[] | null;
  photos: { src: string; view?: string }[] | null;
}

export const CENTER_LIST_COLUMNS =
  'id,name,brand,branch,kind,categories,lat,lng,published,updated_at,logo,photos,address,phones,opening_hours,website,telegram,instagram,summary,about,programs,ages,formats,teaching,lessons,teachers';

export async function loadCenterRows(): Promise<CenterListRow[]> {
  const { data, error } = await supabase!.from('centers').select(CENTER_LIST_COLUMNS).order('name');
  if (error) throw error;
  return data as unknown as CenterListRow[];
}
