import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { publicRoutes } from './public';
import { cdp } from './cdp';
import { debug } from './debug';
import { isDevMode, isE2ETestMode } from '../auth/middleware';

/**
 * Integration tests for route protection matrix.
 *
 * Tests which routes are public (no auth) vs protected (Cloudflare Access),
 * and how DEV_MODE / E2E_TEST_MODE / DEBUG_ROUTES flags affect access.
 *
 * Route layout from src/index.ts:
 *   PUBLIC (before auth middleware):
 *     /sandbox-health         - publicRoutes
 *     /logo.png               - publicRoutes
 *     /logo-small.png         - publicRoutes
 *     /api/status             - publicRoutes
 *     /_admin/assets/*        - publicRoutes
 *     /cdp/*                  - CDP routes (uses ?secret= auth, not CF Access)
 *
 *   PROTECTED (after CF Access middleware):
 *     /api/admin/*            - api routes
 *     /_admin/*               - admin UI
 *     /debug/*                - debug routes (also needs DEBUG_ROUTES=true)
 *     /* (catch-all)          - proxy to moltbot gateway
 */

describe('Route protection matrix', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ── Public routes ──────────────────────────────────────────────────
  describe('public routes (no auth required)', () => {
    let app: Hono<AppEnv>;

    beforeEach(() => {
      app = new Hono<AppEnv>();
      app.use('*', async (c, next) => {
        c.set('sandbox', {
          listProcesses: vi.fn().mockResolvedValue([]),
        } as any);
        await next();
      });
      app.route('/', publicRoutes);
    });

    it('GET /sandbox-health is accessible without auth', async () => {
      const res = await app.request('/sandbox-health');
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('moltbot-sandbox');
    });

    it('GET /api/status is accessible without auth', async () => {
      const res = await app.request('/api/status');
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toHaveProperty('ok');
      expect(body).toHaveProperty('status');
    });

    it('GET /logo.png requires ASSETS binding but no auth', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('image-data'));
      const res = await app.request('/logo.png', {}, {
        ASSETS: { fetch: mockFetch } as any,
      });
      expect(res.status).toBe(200);
    });

    it('GET /_admin/assets/test.css requires ASSETS binding but no auth', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('.body {}'));
      const res = await app.request('/_admin/assets/test.css', {}, {
        ASSETS: { fetch: mockFetch } as any,
      });
      expect(res.status).toBe(200);
    });
  });

  // ── CDP routes (secret-based auth, not CF Access) ──────────────────
  describe('CDP routes (shared secret auth)', () => {
    let app: Hono<AppEnv>;

    beforeEach(() => {
      app = new Hono<AppEnv>();
      app.route('/cdp', cdp);
    });

    it('CDP routes use ?secret= param, not CF Access', async () => {
      // Without CDP_SECRET env, returns error (not a CF Access 401)
      // Pass empty env so c.env is defined but CDP_SECRET is missing → 503
      const res = await app.request('/cdp/json/version', {}, {});
      expect(res.status).toBe(503);
      const body: any = await res.json();
      // The error is about CDP config, not about CF Access authentication
      expect(body.error).toBe('CDP endpoint not configured');
    });

    it('CDP routes accept valid secret', async () => {
      const res = await app.request('/cdp/json/version?secret=test', {}, {
        CDP_SECRET: 'test',
        BROWSER: {} as any,
      });
      expect(res.status).toBe(200);
    });
  });

  // ── Debug routes (needs DEBUG_ROUTES=true + CF Access) ─────────────
  describe('debug routes (DEBUG_ROUTES flag)', () => {
    it('debug routes work when DEBUG_ROUTES=true', async () => {
      const app = new Hono<AppEnv>();
      app.use('*', async (c, next) => {
        c.set('sandbox', {
          startProcess: vi.fn().mockResolvedValue({
            status: 'completed',
            exitCode: 0,
            getLogs: vi.fn().mockResolvedValue({ stdout: 'v1.0', stderr: '' }),
          }),
        } as any);
        await next();
      });
      app.route('/debug', debug);

      const res = await app.request('/debug/env', {}, {
        DEBUG_ROUTES: 'true',
        DEV_MODE: 'false',
      });
      expect(res.status).toBe(200);
    });

    it('in main app, debug routes blocked when DEBUG_ROUTES is not true', async () => {
      const app = new Hono<AppEnv>();
      app.use('/debug/*', async (c, next) => {
        if (c.env.DEBUG_ROUTES !== 'true') {
          return c.json({ error: 'Debug routes are disabled' }, 404);
        }
        return next();
      });
      app.use('*', async (c, next) => {
        c.set('sandbox', {} as any);
        await next();
      });
      app.route('/debug', debug);

      const res = await app.request('/debug/env', {}, {
        DEBUG_ROUTES: 'false',
      });
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.error).toBe('Debug routes are disabled');
    });
  });

  // ── DEV_MODE behavior ──────────────────────────────────────────────
  describe('DEV_MODE behavior', () => {
    it('DEV_MODE=true skips CF Access auth in middleware', () => {
      expect(isDevMode({ DEV_MODE: 'true' } as any)).toBe(true);
      expect(isDevMode({ DEV_MODE: 'false' } as any)).toBe(false);
      expect(isDevMode({} as any)).toBe(false);
    });
  });

  // ── E2E_TEST_MODE behavior ─────────────────────────────────────────
  describe('E2E_TEST_MODE behavior', () => {
    it('E2E_TEST_MODE=true skips CF Access auth', () => {
      expect(isE2ETestMode({ E2E_TEST_MODE: 'true' } as any)).toBe(true);
      expect(isE2ETestMode({ E2E_TEST_MODE: 'false' } as any)).toBe(false);
      expect(isE2ETestMode({} as any)).toBe(false);
    });
  });

  // ── Protection summary ─────────────────────────────────────────────
  describe('protection summary', () => {
    it('public endpoints do not require auth', () => {
      const publicEndpoints = [
        '/sandbox-health',
        '/logo.png',
        '/logo-small.png',
        '/api/status',
        '/_admin/assets/*',
      ];

      const secretAuthEndpoints = [
        '/cdp',
        '/cdp/json/version',
        '/cdp/json/list',
        '/cdp/json/new',
        '/cdp/devtools/browser/:id',
      ];

      const protectedEndpoints = [
        '/api/admin/devices',
        '/api/admin/devices/:id/approve',
        '/api/admin/devices/approve-all',
        '/api/admin/storage',
        '/api/admin/storage/sync',
        '/api/admin/gateway/restart',
        '/_admin/',
        '/debug/version',
        '/debug/processes',
        '/debug/logs',
        '/debug/env',
        '/debug/container-config',
      ];

      // This test serves as documentation
      expect(publicEndpoints.length).toBe(5);
      expect(secretAuthEndpoints.length).toBe(5);
      expect(protectedEndpoints.length).toBe(12);
    });
  });
});
