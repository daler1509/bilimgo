import { createContext, useContext, type ReactNode } from 'react';
import { useStoredIds, type IdListApi } from './storedIds';

/** Places picked for side-by-side comparison. Four columns still fit a laptop. */
export const COMPARE_MAX = 4;

const CompareContext = createContext<IdListApi | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const api = useStoredIds('bilimgo:compare:v1', COMPARE_MAX);
  return <CompareContext.Provider value={api}>{children}</CompareContext.Provider>;
}

export function useCompare(): IdListApi {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider');
  return ctx;
}
