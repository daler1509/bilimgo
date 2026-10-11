import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * An ordered list of centre ids kept in localStorage and in sync across
 * tabs. Shared by favourites and comparison; when accounts exist, the
 * providers sync with the backend while keeping the same interface.
 */
export interface IdListApi {
  ids: string[];
  has: (id: string) => boolean;
  /** Returns the new state: true = added, false = removed, null = list full */
  toggle: (id: string) => boolean | null;
  add: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  restore: (ids: string[]) => void;
  max: number;
}

function read(key: string, max: number): string[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : [];
  } catch {
    return [];
  }
}

export function useStoredIds(key: string, max = Infinity): IdListApi {
  const [ids, setIdsState] = useState<string[]>(() => read(key, max));
  // callbacks read the latest list, so a toast's «undo» never acts on a stale copy
  const current = useRef(ids);
  const setIds = useCallback((next: string[]) => {
    current.current = next;
    setIdsState(next);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      /* storage unavailable (private mode) — keep in memory */
    }
  }, [key, ids]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === key && setIds(read(key, max));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, max, setIds]);

  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const add = useCallback(
    (id: string) => {
      const list = current.current;
      if (list.includes(id)) return true;
      if (list.length >= max) return false;
      setIds([...list, id]);
      return true;
    },
    [max, setIds],
  );
  const remove = useCallback((id: string) => setIds(current.current.filter((x) => x !== id)), [setIds]);
  const toggle = useCallback(
    (id: string) => {
      if (current.current.includes(id)) {
        remove(id);
        return false;
      }
      return add(id) ? true : null;
    },
    [add, remove],
  );
  const clear = useCallback(() => setIds([]), [setIds]);
  const restore = useCallback((next: string[]) => setIds(next.slice(0, max)), [max, setIds]);

  return useMemo(() => ({ ids, has, toggle, add, remove, clear, restore, max }), [ids, has, toggle, add, remove, clear, restore, max]);
}
