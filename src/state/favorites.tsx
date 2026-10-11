import { createContext, useContext, type ReactNode } from 'react';
import { useStoredIds, type IdListApi } from './storedIds';

/** Saved places — kept locally until accounts exist. */
const FavoritesContext = createContext<IdListApi | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const api = useStoredIds('bilimgo:favorites:v1');
  return <FavoritesContext.Provider value={api}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): IdListApi {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
