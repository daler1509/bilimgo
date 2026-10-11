import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './AppShell';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Shown for the split second a directly opened screen's chunk loads */
function RouteLoading() {
  return <div className="route-loading" aria-busy="true" />;
}

/**
 * Every route renders on a direct visit or refresh — state lives in the URL
 * or localStorage. Home ships in the main bundle; other screens load as
 * separate chunks the moment their link is followed. The admin area has its
 * own shell and chunk (with the Supabase SDK) that visitors never download.
 */
const admin = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => () =>
  load().then((m) => ({ Component: m[name] }));

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/search', lazy: () => import('@/pages/search/SearchPage').then((m) => ({ Component: m.SearchPage })) },
      { path: '/map', lazy: () => import('@/pages/map/MapPage').then((m) => ({ Component: m.MapPage })) },
      { path: '/centers/:id', lazy: () => import('@/pages/center/CenterPage').then((m) => ({ Component: m.CenterPage })) },
      { path: '/favorites', lazy: () => import('@/pages/favorites/FavoritesPage').then((m) => ({ Component: m.FavoritesPage })) },
      { path: '/add-center', lazy: () => import('@/pages/add-center/AddCenterPage').then((m) => ({ Component: m.AddCenterPage })) },
      { path: '/compare', lazy: () => import('@/pages/compare/ComparePage').then((m) => ({ Component: m.ComparePage })) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    hydrateFallbackElement: <RouteLoading />,
    lazy: admin(() => import('@/admin/AdminLayout'), 'AdminLayout'),
    children: [
      { index: true, element: <Navigate to="centers" replace /> },
      { path: 'login', lazy: admin(() => import('@/admin/AdminLogin'), 'AdminLogin') },
      { path: 'centers', lazy: admin(() => import('@/admin/AdminCenters'), 'AdminCenters') },
      { path: 'centers/new', lazy: admin(() => import('@/admin/AdminCenterEditor'), 'AdminCenterEditor') },
      { path: 'centers/:id', lazy: admin(() => import('@/admin/AdminCenterEditor'), 'AdminCenterEditor') },
      { path: 'submissions', lazy: admin(() => import('@/admin/AdminSubmissions'), 'AdminSubmissions') },
      { path: 'leads', lazy: admin(() => import('@/admin/AdminLeads'), 'AdminLeads') },
    ],
  },
]);
