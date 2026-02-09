import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { cdp } from './cdp';

/**
 * Tests for CDP route auth logic and discovery endpoints.
 *
 * All discovery endpoints share the same auth pattern:
 * 1. No CDP_SECRET env → 503
 * 2. Missing/invalid ?secret= → 401
 * 3. No BROWSER binding → 503
 * 4. Valid auth → 200 with endpoint-specific response
 *
 * WebSocket endpoints (GET /, GET /devtools/browser/:id) check the Upgrade
 * header first, so without it they return info/error without auth.
 */
describe('CDP routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/cdp', cdp);
  });

  // ── Helper ──────────────────────────────────────────────────────────
  const validEnv = {
    CDP_SECRET: 'test-secret',
    BROWSER: {} as unknown,
  };

  // ── GET /cdp/json/version ──────────────────────────────────────────
  describe('GET /cdp/json/version', () => {
    it('returns 503 when CDP_SECRET is not set', async () => {
      const res = await app.request('/cdp/json/version', {}, {});
      expect(res.status).toBe(503);
      const body: any = await res.json();
      expect(body.error).toBe('CDP endpoint not configured');
      expect(body.hint).toContain('CDP_SECRET');
    });

    it('returns 401 when secret query param is missing', async () => {
      const res = await app.request('/cdp/json/version', {}, validEnv);
      expect(res.status).toBe(401);
      const body: any = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when secret is invalid', async () => {
      const res = await app.request('/cdp/json/version?secret=wrong', {}, validEnv);
      expect(res.status).toBe(401);
    });

    it('returns 503 when BROWSER binding is missing', async () => {
      const res = await app.request('/cdp/json/version?secret=test-secret', {}, {
        CDP_SECRET: 'test-secret',
      });
      expect(res.status).toBe(503);
      const body: any = await res.json();
      expect(body.error).toBe('Browser Rendering not configured');
    });

    it('returns 200 with version info on success', async () => {
      const res = await app.request(
        '/cdp/json/version?secret=test-secret',
        {},
        validEnv,
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toHaveProperty('Browser');
      expect(body).toHaveProperty('Protocol-Version', '1.3');
      expect(body).toHaveProperty('webSocketDebuggerUrl');
      expect(body.webSocketDebuggerUrl).toContain('secret=');
    });
  });

  // ── GET /cdp/json/list ─────────────────────────────────────────────
  describe('GET /cdp/json/list', () => {
    it('returns 503 when CDP_SECRET is not set', async () => {
      const res = await app.request('/cdp/json/list', {}, {});
      expect(res.status).toBe(503);
    });

    it('returns 401 when secret is missing', async () => {
      const res = await app.request('/cdp/json/list', {}, validEnv);
      expect(res.status).toBe(401);
    });

    it('returns 401 when secret is invalid', async () => {
      const res = await app.request('/cdp/json/list?secret=wrong', {}, validEnv);
      expect(res.status).toBe(401);
    });

    it('returns 503 when BROWSER binding is missing', async () => {
      const res = await app.request('/cdp/json/list?secret=test-secret', {}, {
        CDP_SECRET: 'test-secret',
      });
      expect(res.status).toBe(503);
    });

    it('returns 200 with array of targets on success', async () => {
      const res = await app.request(
        '/cdp/json/list?secret=test-secret',
        {},
        validEnv,
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('id');
      expect(body[0]).toHaveProperty('type', 'page');
      expect(body[0]).toHaveProperty('webSocketDebuggerUrl');
    });
  });

  // ── GET /cdp/json/new ──────────────────────────────────────────────
  describe('GET /cdp/json/new', () => {
    it('returns 503 when CDP_SECRET is not set', async () => {
      const res = await app.request('/cdp/json/new', {}, {});
      expect(res.status).toBe(503);
    });

    it('returns 401 when secret is missing', async () => {
      const res = await app.request('/cdp/json/new', {}, validEnv);
      expect(res.status).toBe(401);
    });

    it('returns 401 when secret is invalid', async () => {
      const res = await app.request('/cdp/json/new?secret=wrong', {}, validEnv);
      expect(res.status).toBe(401);
    });

    it('returns 503 when BROWSER binding is missing', async () => {
      const res = await app.request('/cdp/json/new?secret=test-secret', {}, {
        CDP_SECRET: 'test-secret',
      });
      expect(res.status).toBe(503);
    });

    it('returns 200 with new target info on success', async () => {
      const res = await app.request(
        '/cdp/json/new?secret=test-secret',
        {},
        validEnv,
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('type', 'page');
      expect(body).toHaveProperty('title', 'New Tab');
      expect(body).toHaveProperty('url', 'about:blank');
      expect(body).toHaveProperty('webSocketDebuggerUrl');
    });

    it('generates unique target IDs', async () => {
      const res1 = await app.request('/cdp/json/new?secret=test-secret', {}, validEnv);
      const res2 = await app.request('/cdp/json/new?secret=test-secret', {}, validEnv);
      const body1: any = await res1.json();
      const body2: any = await res2.json();
      expect(body1.id).not.toBe(body2.id);
    });
  });

  // ── GET /cdp/json (alias for /json/list) ───────────────────────────
  describe('GET /cdp/json', () => {
    it('returns 503 when CDP_SECRET is not set', async () => {
      const res = await app.request('/cdp/json', {}, {});
      expect(res.status).toBe(503);
    });

    it('returns 401 when secret is missing', async () => {
      const res = await app.request('/cdp/json', {}, validEnv);
      expect(res.status).toBe(401);
    });

    it('returns 200 with array of targets on success (same as /json/list)', async () => {
      const res = await app.request('/cdp/json?secret=test-secret', {}, validEnv);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('id');
    });
  });

  // ── GET /cdp (WS endpoint, no Upgrade header) ─────────────────────
  describe('GET /cdp (no Upgrade header)', () => {
    it('returns supported methods list without auth check', async () => {
      // Without Upgrade header, the endpoint returns info JSON and does NOT check auth
      const res = await app.request('/cdp', {}, {});
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toHaveProperty('supported_methods');
      expect(Array.isArray(body.supported_methods)).toBe(true);
      expect(body.supported_methods).toContain('Browser.getVersion');
      expect(body.supported_methods).toContain('Page.navigate');
    });

    it('returns hint about WebSocket connection', async () => {
      const res = await app.request('/cdp', {}, {});
      const body: any = await res.json();
      expect(body).toHaveProperty('hint');
      expect(body.hint).toContain('WebSocket');
    });
  });

  // ── GET /cdp/devtools/browser/:id (WS alias, no Upgrade header) ───
  describe('GET /cdp/devtools/browser/:id (no Upgrade header)', () => {
    it('returns error about WebSocket upgrade without auth check', async () => {
      // Without Upgrade header, the alias returns a JSON error and does NOT check auth
      const res = await app.request('/cdp/devtools/browser/some-id', {}, {});
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('WebSocket upgrade required');
    });

    it('includes hint about connection', async () => {
      const res = await app.request('/cdp/devtools/browser/some-id', {}, {});
      const body: any = await res.json();
      expect(body).toHaveProperty('hint');
      expect(body.hint).toContain('devtools/browser');
    });
  });

  // ── Auth edge cases ────────────────────────────────────────────────
  describe('auth edge cases', () => {
    it('rejects secrets of different length (timing-safe check)', async () => {
      const res = await app.request('/cdp/json/version?secret=short', {}, {
        CDP_SECRET: 'much-longer-secret-value',
        BROWSER: {} as unknown,
      });
      expect(res.status).toBe(401);
    });

    it('handles URL-encoded secret in query param', async () => {
      const secret = 'test+secret/with=special&chars';
      const res = await app.request(
        `/cdp/json/version?secret=${encodeURIComponent(secret)}`,
        {},
        { CDP_SECRET: secret, BROWSER: {} as unknown },
      );
      expect(res.status).toBe(200);
    });
  });
});
