import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types';

/**
 * Tests for /api/admin/* route behavior.
 *
 * The admin API routes use:
 * - ensureMoltbotGateway (from gateway module)
 * - sandbox.startProcess (for CLI commands)
 * - waitForProcess (from gateway/utils)
 * - findExistingMoltbotProcess (for restart)
 * - mountR2Storage / syncToR2 (for storage)
 *
 * We mock these dependencies and test route handler logic.
 */

// Mock gateway module
vi.mock('../gateway', () => ({
  ensureMoltbotGateway: vi.fn(),
  findExistingMoltbotProcess: vi.fn(),
  mountR2Storage: vi.fn(),
  syncToR2: vi.fn(),
  waitForProcess: vi.fn(),
}));

// Mock auth module - createAccessMiddleware should pass through in tests
vi.mock('../auth', () => ({
  createAccessMiddleware: vi.fn(() => {
    return async (_c: any, next: any) => next();
  }),
}));

import { api } from './api';
import { ensureMoltbotGateway, findExistingMoltbotProcess, syncToR2 } from '../gateway';

describe('API admin routes', () => {
  let app: Hono<AppEnv>;

  // Mock process helper
  function createMockProc(opts: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    status?: string;
  } = {}) {
    return {
      id: 'proc-1',
      status: opts.status ?? 'completed',
      exitCode: opts.exitCode ?? 0,
      getLogs: vi.fn().mockResolvedValue({
        stdout: opts.stdout ?? '',
        stderr: opts.stderr ?? '',
      }),
      kill: vi.fn().mockResolvedValue(undefined),
    };
  }

  // Mock sandbox helper
  function createMockSandbox() {
    return {
      startProcess: vi.fn(),
      listProcesses: vi.fn().mockResolvedValue([]),
      mountBucket: vi.fn(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Suppress console
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    app = new Hono<AppEnv>();
    // Middleware to inject sandbox and env
    app.use('*', async (c, next) => {
      if (!c.get('sandbox')) {
        c.set('sandbox', createMockSandbox() as any);
      }
      await next();
    });
    app.route('/api', api);
  });

  // Helper: build app with specific sandbox
  function buildApp(sandbox: ReturnType<typeof createMockSandbox>, envOverrides: Record<string, any> = {}) {
    const testApp = new Hono<AppEnv>();
    testApp.use('*', async (c, next) => {
      c.set('sandbox', sandbox as any);
      await next();
    });
    testApp.route('/api', api);
    return { testApp, env: envOverrides };
  }

  // ── GET /api/admin/devices ─────────────────────────────────────────
  describe('GET /api/admin/devices', () => {
    it('returns parsed JSON device list', async () => {
      const devicesJson = JSON.stringify({
        pending: [{ requestId: 'req-1', displayName: 'iPhone' }],
        paired: [{ deviceId: 'dev-1', displayName: 'Laptop' }],
      });
      const proc = createMockProc({ stdout: devicesJson });
      const sandbox = createMockSandbox();
      sandbox.startProcess.mockResolvedValue(proc);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/devices', {}, { MOLTBOT_GATEWAY_TOKEN: 'token-123' });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.pending).toHaveLength(1);
      expect(body.paired).toHaveLength(1);
      expect(body.pending[0].requestId).toBe('req-1');
    });

    it('returns empty lists when no JSON found in output', async () => {
      const proc = createMockProc({ stdout: 'No devices found\n' });
      const sandbox = createMockSandbox();
      sandbox.startProcess.mockResolvedValue(proc);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/devices', {}, { MOLTBOT_GATEWAY_TOKEN: 'tok' });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.pending).toEqual([]);
      expect(body.paired).toEqual([]);
      expect(body.raw).toBe('No devices found\n');
    });

    it('returns 500 when gateway fails to start', async () => {
      vi.mocked(ensureMoltbotGateway).mockRejectedValue(new Error('Gateway OOM'));

      const sandbox = createMockSandbox();
      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/devices', {}, {});
      expect(res.status).toBe(500);

      const body: any = await res.json();
      expect(body.error).toContain('Gateway OOM');
    });

    it('includes gateway token in CLI command', async () => {
      const proc = createMockProc({ stdout: '{}' });
      const sandbox = createMockSandbox();
      sandbox.startProcess.mockResolvedValue(proc);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const { testApp } = buildApp(sandbox);
      await testApp.request('/api/admin/devices', {}, { MOLTBOT_GATEWAY_TOKEN: 'my-token' });

      expect(sandbox.startProcess).toHaveBeenCalledWith(
        expect.stringContaining('--token my-token'),
      );
    });
  });

  // ── POST /api/admin/devices/:requestId/approve ─────────────────────
  describe('POST /api/admin/devices/:requestId/approve', () => {
    it('approves a device successfully', async () => {
      const proc = createMockProc({ stdout: 'Approved device req-42', exitCode: 0 });
      const sandbox = createMockSandbox();
      sandbox.startProcess.mockResolvedValue(proc);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/devices/req-42/approve', {
        method: 'POST',
      }, { MOLTBOT_GATEWAY_TOKEN: 'tok' });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.requestId).toBe('req-42');
      expect(body.message).toBe('Device approved');
    });

    it('reports possible failure when approve output is unexpected', async () => {
      const proc = createMockProc({ stdout: 'Error: device not found', exitCode: 1 });
      const sandbox = createMockSandbox();
      sandbox.startProcess.mockResolvedValue(proc);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/devices/req-99/approve', {
        method: 'POST',
      }, { MOLTBOT_GATEWAY_TOKEN: 'tok' });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      // exitCode 0 counts as success even with unexpected output
      // exitCode 1 + no "approved" text → success is false
      expect(body.success).toBe(false);
      expect(body.message).toBe('Approval may have failed');
    });

    it('returns 500 when gateway fails', async () => {
      vi.mocked(ensureMoltbotGateway).mockRejectedValue(new Error('Timeout'));

      const sandbox = createMockSandbox();
      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/devices/req-1/approve', {
        method: 'POST',
      }, {});
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/admin/devices/approve-all ────────────────────────────
  describe('POST /api/admin/devices/approve-all', () => {
    it('approves all pending devices', async () => {
      const listJson = JSON.stringify({
        pending: [{ requestId: 'req-1' }, { requestId: 'req-2' }],
        paired: [],
      });
      const listProc = createMockProc({ stdout: listJson });
      const approveProc1 = createMockProc({ stdout: 'Approved req-1', exitCode: 0 });
      const approveProc2 = createMockProc({ stdout: 'Approved req-2', exitCode: 0 });

      const sandbox = createMockSandbox();
      sandbox.startProcess
        .mockResolvedValueOnce(listProc)
        .mockResolvedValueOnce(approveProc1)
        .mockResolvedValueOnce(approveProc2);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/devices/approve-all', {
        method: 'POST',
      }, { MOLTBOT_GATEWAY_TOKEN: 'tok' });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.approved).toEqual(['req-1', 'req-2']);
      expect(body.message).toContain('Approved 2 of 2');
    });

    it('returns message when no pending devices', async () => {
      const listJson = JSON.stringify({ pending: [], paired: [] });
      const listProc = createMockProc({ stdout: listJson });

      const sandbox = createMockSandbox();
      sandbox.startProcess.mockResolvedValue(listProc);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/devices/approve-all', {
        method: 'POST',
      }, { MOLTBOT_GATEWAY_TOKEN: 'tok' });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.message).toContain('No pending devices');
    });
  });

  // ── GET /api/admin/storage ─────────────────────────────────────────
  describe('GET /api/admin/storage', () => {
    it('reports R2 not configured when credentials missing', async () => {
      const sandbox = createMockSandbox();
      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/storage', {}, {});
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.configured).toBe(false);
      expect(body.missing).toContain('R2_ACCESS_KEY_ID');
      expect(body.missing).toContain('R2_SECRET_ACCESS_KEY');
      expect(body.missing).toContain('CF_ACCOUNT_ID');
    });

    it('reports R2 configured when all credentials present', async () => {
      const proc = createMockProc({ stdout: '2025-01-01T00:00:00Z' });
      const sandbox = createMockSandbox();
      sandbox.startProcess.mockResolvedValue(proc);

      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/storage', {}, {
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        CF_ACCOUNT_ID: 'account',
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.configured).toBe(true);
      expect(body.missing).toBeUndefined();
    });
  });

  // ── POST /api/admin/storage/sync ───────────────────────────────────
  describe('POST /api/admin/storage/sync', () => {
    it('returns success when sync succeeds', async () => {
      vi.mocked(syncToR2).mockResolvedValue({
        success: true,
        lastSync: '2025-01-01T00:00:00Z',
      });

      const sandbox = createMockSandbox();
      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/storage/sync', {
        method: 'POST',
      }, {});
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.lastSync).toBe('2025-01-01T00:00:00Z');
    });

    it('returns 400 when R2 not configured', async () => {
      vi.mocked(syncToR2).mockResolvedValue({
        success: false,
        error: 'R2 storage not configured',
      });

      const sandbox = createMockSandbox();
      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/storage/sync', {
        method: 'POST',
      }, {});
      expect(res.status).toBe(400);

      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('not configured');
    });

    it('returns 500 on sync failure', async () => {
      vi.mocked(syncToR2).mockResolvedValue({
        success: false,
        error: 'Sync failed',
        details: 'Mount error',
      });

      const sandbox = createMockSandbox();
      const { testApp } = buildApp(sandbox);
      const res = await testApp.request('/api/admin/storage/sync', {
        method: 'POST',
      }, {});
      expect(res.status).toBe(500);

      const body: any = await res.json();
      expect(body.error).toBe('Sync failed');
      expect(body.details).toBe('Mount error');
    });
  });

  // ── POST /api/admin/gateway/restart ────────────────────────────────
  describe('POST /api/admin/gateway/restart', () => {
    it('kills existing process and starts new one', async () => {
      const existingProc = createMockProc({ status: 'running' });
      vi.mocked(findExistingMoltbotProcess).mockResolvedValue(existingProc as any);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const sandbox = createMockSandbox();
      const testApp = new Hono<AppEnv>();
      testApp.use('*', async (c, next) => {
        c.set('sandbox', sandbox as any);
        // Provide executionCtx for waitUntil
        Object.defineProperty(c, 'executionCtx', {
          get: () => ({ waitUntil: vi.fn() }),
        });
        await next();
      });
      testApp.route('/api', api);

      const res = await testApp.request('/api/admin/gateway/restart', {
        method: 'POST',
      }, {});
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('killed');
      expect(existingProc.kill).toHaveBeenCalled();
    });

    it('starts new instance when no existing process', async () => {
      vi.mocked(findExistingMoltbotProcess).mockResolvedValue(null);
      vi.mocked(ensureMoltbotGateway).mockResolvedValue(createMockProc() as any);

      const sandbox = createMockSandbox();
      const testApp = new Hono<AppEnv>();
      testApp.use('*', async (c, next) => {
        c.set('sandbox', sandbox as any);
        Object.defineProperty(c, 'executionCtx', {
          get: () => ({ waitUntil: vi.fn() }),
        });
        await next();
      });
      testApp.route('/api', api);

      const res = await testApp.request('/api/admin/gateway/restart', {
        method: 'POST',
      }, {});
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('No existing process');
    });

    it('returns 500 on error', async () => {
      vi.mocked(findExistingMoltbotProcess).mockRejectedValue(new Error('Sandbox unavailable'));

      const sandbox = createMockSandbox();
      const testApp = new Hono<AppEnv>();
      testApp.use('*', async (c, next) => {
        c.set('sandbox', sandbox as any);
        Object.defineProperty(c, 'executionCtx', {
          get: () => ({ waitUntil: vi.fn() }),
        });
        await next();
      });
      testApp.route('/api', api);

      const res = await testApp.request('/api/admin/gateway/restart', {
        method: 'POST',
      }, {});
      expect(res.status).toBe(500);

      const body: any = await res.json();
      expect(body.error).toContain('Sandbox unavailable');
    });
  });
});
