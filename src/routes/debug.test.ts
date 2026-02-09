import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { debug } from './debug';
import type { AppEnv } from '../types';

/**
 * Tests for /debug/* route behavior.
 *
 * Debug routes require:
 * - `sandbox` to be set in the context variables (via middleware in real app)
 * - Various sandbox methods: startProcess, listProcesses, containerFetch
 *
 * We mock the sandbox and test response formats and error handling.
 */
describe('debug routes', () => {
  let app: Hono<AppEnv>;

  // Mock process object
  function createMockProc(opts: {
    stdout?: string;
    stderr?: string;
    status?: string;
    exitCode?: number;
    id?: string;
    command?: string;
    startTime?: Date;
    endTime?: Date;
  } = {}) {
    return {
      id: opts.id ?? 'proc-1',
      command: opts.command ?? 'test-cmd',
      status: opts.status ?? 'completed',
      exitCode: opts.exitCode ?? 0,
      startTime: opts.startTime ?? new Date('2025-01-01T00:00:00Z'),
      endTime: opts.endTime ?? new Date('2025-01-01T00:00:01Z'),
      getLogs: vi.fn().mockResolvedValue({
        stdout: opts.stdout ?? '',
        stderr: opts.stderr ?? '',
      }),
      kill: vi.fn(),
      waitForPort: vi.fn(),
    };
  }

  // Create mock sandbox
  function createMockSandbox(overrides: Record<string, unknown> = {}) {
    return {
      startProcess: vi.fn(),
      listProcesses: vi.fn().mockResolvedValue([]),
      containerFetch: vi.fn(),
      ...overrides,
    };
  }

  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    app = new Hono<AppEnv>();
    // We need middleware to set the sandbox variable
  });

  // ── Helper to build a test app with a given sandbox mock ──────────
  function buildApp(sandbox: ReturnType<typeof createMockSandbox>) {
    const testApp = new Hono<AppEnv>();
    testApp.use('*', async (c, next) => {
      c.set('sandbox', sandbox as any);
      await next();
    });
    testApp.route('/debug', debug);
    return testApp;
  }

  // ── GET /debug/version ─────────────────────────────────────────────
  describe('GET /debug/version', () => {
    it('returns moltbot and node versions', async () => {
      const versionProc = createMockProc({ stdout: 'openclaw v2026.2.3' });
      const nodeProc = createMockProc({ stdout: 'v22.0.0' });

      const sandbox = createMockSandbox({
        startProcess: vi.fn()
          .mockResolvedValueOnce(versionProc)
          .mockResolvedValueOnce(nodeProc),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/version');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('moltbot_version', 'openclaw v2026.2.3');
      expect(body).toHaveProperty('node_version', 'v22.0.0');
    });

    it('trims whitespace from version strings', async () => {
      const versionProc = createMockProc({ stdout: '  openclaw v2026.2.3\n' });
      const nodeProc = createMockProc({ stdout: '  v22.0.0\n' });

      const sandbox = createMockSandbox({
        startProcess: vi.fn()
          .mockResolvedValueOnce(versionProc)
          .mockResolvedValueOnce(nodeProc),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/version');
      const body = await res.json();
      expect(body.moltbot_version).toBe('openclaw v2026.2.3');
      expect(body.node_version).toBe('v22.0.0');
    });

    it('uses stderr as fallback for moltbot version', async () => {
      const versionProc = createMockProc({ stdout: '', stderr: 'openclaw v2026.2.3' });
      const nodeProc = createMockProc({ stdout: 'v22.0.0' });

      const sandbox = createMockSandbox({
        startProcess: vi.fn()
          .mockResolvedValueOnce(versionProc)
          .mockResolvedValueOnce(nodeProc),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/version');
      const body = await res.json();
      expect(body.moltbot_version).toBe('openclaw v2026.2.3');
    });

    it('returns 500 on sandbox error', async () => {
      const sandbox = createMockSandbox({
        startProcess: vi.fn().mockRejectedValue(new Error('Container unavailable')),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/version');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.status).toBe('error');
      expect(body.message).toContain('Container unavailable');
    });
  });

  // ── GET /debug/processes ───────────────────────────────────────────
  describe('GET /debug/processes', () => {
    it('returns empty process list', async () => {
      const sandbox = createMockSandbox();
      const testApp = buildApp(sandbox);

      const res = await testApp.request('/debug/processes');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('count', 0);
      expect(body).toHaveProperty('processes');
      expect(body.processes).toEqual([]);
    });

    it('returns process list with basic info', async () => {
      const proc = createMockProc({
        id: 'proc-123',
        command: 'openclaw gateway start',
        status: 'running',
        exitCode: null as any,
      });

      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockResolvedValue([proc]),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/processes');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.count).toBe(1);
      expect(body.processes[0]).toHaveProperty('id', 'proc-123');
      expect(body.processes[0]).toHaveProperty('command', 'openclaw gateway start');
      expect(body.processes[0]).toHaveProperty('status', 'running');
      // Without ?logs=true, should not include stdout/stderr
      expect(body.processes[0]).not.toHaveProperty('stdout');
      expect(body.processes[0]).not.toHaveProperty('stderr');
    });

    it('includes logs when ?logs=true', async () => {
      const proc = createMockProc({
        stdout: 'Starting gateway...',
        stderr: 'Warning: something',
      });

      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockResolvedValue([proc]),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/processes?logs=true');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.processes[0]).toHaveProperty('stdout', 'Starting gateway...');
      expect(body.processes[0]).toHaveProperty('stderr', 'Warning: something');
    });

    it('sorts processes by status (running first, then starting, completed, failed)', async () => {
      const running = createMockProc({ id: 'running', status: 'running' });
      const completed = createMockProc({ id: 'completed', status: 'completed' });
      const failed = createMockProc({ id: 'failed', status: 'failed' });

      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockResolvedValue([completed, failed, running]),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/processes');
      const body = await res.json();
      expect(body.processes[0].id).toBe('running');
      expect(body.processes[1].id).toBe('completed');
      expect(body.processes[2].id).toBe('failed');
    });

    it('returns 500 on sandbox error', async () => {
      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockRejectedValue(new Error('Connection lost')),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/processes');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toContain('Connection lost');
    });
  });

  // ── GET /debug/logs ────────────────────────────────────────────────
  describe('GET /debug/logs', () => {
    it('returns logs for gateway process (default)', async () => {
      const proc = createMockProc({
        id: 'gw-1',
        command: 'openclaw gateway start --bind lan',
        status: 'running',
        stdout: 'Gateway started',
        stderr: '',
      });

      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockResolvedValue([proc]),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/logs');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.process_id).toBe('gw-1');
      expect(body.stdout).toBe('Gateway started');
    });

    it('returns no_process when gateway is not running', async () => {
      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockResolvedValue([]),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/logs');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('no_process');
      expect(body.stdout).toBe('');
      expect(body.stderr).toBe('');
    });

    it('returns logs for specific process by id', async () => {
      const proc = createMockProc({
        id: 'specific-proc',
        stdout: 'Specific output',
      });

      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockResolvedValue([proc]),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/logs?id=specific-proc');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.process_id).toBe('specific-proc');
      expect(body.stdout).toBe('Specific output');
    });

    it('returns 404 when specific process not found', async () => {
      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockResolvedValue([]),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/logs?id=nonexistent');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.status).toBe('not_found');
    });

    it('returns no_process when sandbox listProcesses fails (error caught by findExistingMoltbotProcess)', async () => {
      // findExistingMoltbotProcess catches errors internally and returns null
      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockRejectedValue(new Error('Sandbox crash')),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/logs');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('no_process');
    });

    it('returns 500 when getLogs fails for a specific process', async () => {
      const proc = createMockProc({ id: 'err-proc' });
      proc.getLogs = vi.fn().mockRejectedValue(new Error('Log retrieval failed'));

      const sandbox = createMockSandbox({
        listProcesses: vi.fn().mockResolvedValue([proc]),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/logs?id=err-proc');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.status).toBe('error');
      expect(body.message).toContain('Log retrieval failed');
    });
  });

  // ── GET /debug/env ─────────────────────────────────────────────────
  describe('GET /debug/env', () => {
    it('returns sanitized environment info', async () => {
      const sandbox = createMockSandbox();
      const testApp = new Hono<AppEnv>();
      testApp.use('*', async (c, next) => {
        c.set('sandbox', sandbox as any);
        await next();
      });
      testApp.route('/debug', debug);

      const res = await testApp.request('/debug/env', {}, {
        ANTHROPIC_API_KEY: 'sk-secret-key',
        MOLTBOT_GATEWAY_TOKEN: 'token-123',
        DEV_MODE: 'true',
        DEBUG_ROUTES: 'true',
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      // Should show boolean flags, not actual secret values
      expect(body.has_anthropic_key).toBe(true);
      expect(body.has_gateway_token).toBe(true);
      expect(body.dev_mode).toBe('true');
      expect(body.debug_routes).toBe('true');
      // Should NOT expose actual secret values
      expect(JSON.stringify(body)).not.toContain('sk-secret-key');
      expect(JSON.stringify(body)).not.toContain('token-123');
    });

    it('shows false for missing keys', async () => {
      const sandbox = createMockSandbox();
      const testApp = new Hono<AppEnv>();
      testApp.use('*', async (c, next) => {
        c.set('sandbox', sandbox as any);
        await next();
      });
      testApp.route('/debug', debug);

      const res = await testApp.request('/debug/env', {}, {});
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.has_anthropic_key).toBe(false);
      expect(body.has_openai_key).toBe(false);
      expect(body.has_gateway_token).toBe(false);
    });
  });

  // ── GET /debug/container-config ────────────────────────────────────
  describe('GET /debug/container-config', () => {
    it('returns parsed JSON config', async () => {
      const configJson = JSON.stringify({ version: '2026.2', bind: 'lan' });
      const proc = createMockProc({
        stdout: configJson,
        status: 'completed',
        exitCode: 0,
      });

      const sandbox = createMockSandbox({
        startProcess: vi.fn().mockResolvedValue(proc),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/container-config');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.config).toEqual({ version: '2026.2', bind: 'lan' });
      expect(body.status).toBe('completed');
      expect(body.exitCode).toBe(0);
      // When config is parsed, raw should be undefined
      expect(body.raw).toBeUndefined();
    });

    it('returns raw output when config is not valid JSON', async () => {
      const proc = createMockProc({
        stdout: 'Not a JSON file',
        status: 'completed',
        exitCode: 0,
      });

      const sandbox = createMockSandbox({
        startProcess: vi.fn().mockResolvedValue(proc),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/container-config');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.config).toBeNull();
      expect(body.raw).toBe('Not a JSON file');
    });

    it('returns stderr when command fails', async () => {
      const proc = createMockProc({
        stdout: '',
        stderr: 'cat: /root/.openclaw/openclaw.json: No such file or directory',
        status: 'completed',
        exitCode: 1,
      });

      const sandbox = createMockSandbox({
        startProcess: vi.fn().mockResolvedValue(proc),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/container-config');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.stderr).toContain('No such file or directory');
    });

    it('returns 500 on sandbox error', async () => {
      const sandbox = createMockSandbox({
        startProcess: vi.fn().mockRejectedValue(new Error('Process start failed')),
      });

      const testApp = buildApp(sandbox);
      const res = await testApp.request('/debug/container-config');
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toContain('Process start failed');
    });
  });
});
