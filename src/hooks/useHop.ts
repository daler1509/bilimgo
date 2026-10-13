import { useEffect, useRef, useState } from 'react';

/**
 * Counts changes of a value, never the first one. Use the result as a React
 * `key` and show an entrance animation when it is above 0: a number hops in
 * when it changes, and a page that merely mounts with it stays quiet.
 */
export function useHop(value: number): number {
  const [hops, setHops] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) setHops((h) => h + 1);
    prev.current = value;
  }, [value]);
  return hops;
}
