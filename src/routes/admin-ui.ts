import { Hono } from 'hono';
import type { AppEnv } from '../types';

/**
 * Admin UI routes
 * Serves the SPA from the ASSETS binding.
 *
 * Note: Static assets (/_admin/assets/*) are handled by publicRoutes.
 * Auth is applied centrally in index.ts before this app is mounted.
 *
 * In Vite dev mode, paths like @vite/client, @react-refresh, and src/*
 * must NOT be caught here — they need to pass through to Vite's dev server.
 */
const adminUi = new Hono<AppEnv>();

// Vite dev paths that must pass through to the Vite dev server
const VITE_DEV_PREFIXES = ['/@vite/', '/@react-refresh', '/@fs/', '/src/', '/node_modules/'];

// Serve index.html for all admin routes (SPA), except Vite dev paths
adminUi.get('*', async (c) => {
  const url = new URL(c.req.url);
  // The path relative to the /_admin mount point
  const mountedPath = url.pathname.replace(/^\/_admin/, '');

  // In dev mode, skip Vite internal paths so they can be served by Vite's dev server.
  // The ASSETS binding in dev mode routes through Vite's middleware stack, which can
  // serve these transformed modules correctly.
  if (c.env.DEV_MODE === 'true') {
    for (const prefix of VITE_DEV_PREFIXES) {
      if (mountedPath.startsWith(prefix)) {
        // Pass the full original path to ASSETS — in dev mode this routes through
        // Vite's middleware which will serve the transformed module
        return c.env.ASSETS.fetch(new Request(new URL(url.pathname, url.origin).toString(), c.req.raw));
      }
    }
  }

  return c.env.ASSETS.fetch(new Request(new URL('/index.html', url.origin).toString()));
});

export { adminUi };
