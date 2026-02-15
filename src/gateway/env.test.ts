import { describe, it, expect } from 'vitest';
import { buildEnvVars, resolveStartupAuthChoice } from './env';
import { createMockEnv } from '../test-utils';

describe('buildEnvVars', () => {
  it('returns empty object when no env vars set', () => {
    const env = createMockEnv();
    const result = buildEnvVars(env);
    expect(result).toEqual({});
  });

  it('includes ANTHROPIC_API_KEY when set directly', () => {
    const env = createMockEnv({ ANTHROPIC_API_KEY: 'sk-test-key' });
    const result = buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('sk-test-key');
  });

  it('includes OPENAI_API_KEY when set directly', () => {
    const env = createMockEnv({ OPENAI_API_KEY: 'sk-openai-key' });
    const result = buildEnvVars(env);
    expect(result.OPENAI_API_KEY).toBe('sk-openai-key');
  });

  // Cloudflare AI Gateway (new native provider)
  it('passes Cloudflare AI Gateway env vars', () => {
    const env = createMockEnv({
      CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-gw-key',
      CF_AI_GATEWAY_ACCOUNT_ID: 'my-account-id',
      CF_AI_GATEWAY_GATEWAY_ID: 'my-gateway-id',
    });
    const result = buildEnvVars(env);
    expect(result.CLOUDFLARE_AI_GATEWAY_API_KEY).toBe('cf-gw-key');
    expect(result.CF_AI_GATEWAY_ACCOUNT_ID).toBe('my-account-id');
    expect(result.CF_AI_GATEWAY_GATEWAY_ID).toBe('my-gateway-id');
  });

  it('passes Cloudflare AI Gateway alongside direct Anthropic key', () => {
    const env = createMockEnv({
      CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-gw-key',
      CF_AI_GATEWAY_ACCOUNT_ID: 'my-account-id',
      CF_AI_GATEWAY_GATEWAY_ID: 'my-gateway-id',
      ANTHROPIC_API_KEY: 'sk-anthro',
    });
    const result = buildEnvVars(env);
    expect(result.CLOUDFLARE_AI_GATEWAY_API_KEY).toBe('cf-gw-key');
    expect(result.ANTHROPIC_API_KEY).toBe('sk-anthro');
  });

  // Legacy AI Gateway support
  it('maps legacy AI_GATEWAY_API_KEY to ANTHROPIC_API_KEY with base URL', () => {
    const env = createMockEnv({
      AI_GATEWAY_API_KEY: 'sk-gateway-key',
      AI_GATEWAY_BASE_URL: 'https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic',
    });
    const result = buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('sk-gateway-key');
    expect(result.ANTHROPIC_BASE_URL).toBe(
      'https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic',
    );
    expect(result.AI_GATEWAY_BASE_URL).toBe(
      'https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic',
    );
  });

  it('legacy AI_GATEWAY_* overrides direct ANTHROPIC_API_KEY', () => {
    const env = createMockEnv({
      AI_GATEWAY_API_KEY: 'gateway-key',
      AI_GATEWAY_BASE_URL: 'https://gateway.example.com/anthropic',
      ANTHROPIC_API_KEY: 'direct-key',
    });
    const result = buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('gateway-key');
    expect(result.AI_GATEWAY_BASE_URL).toBe('https://gateway.example.com/anthropic');
  });

  it('strips trailing slashes from legacy AI_GATEWAY_BASE_URL', () => {
    const env = createMockEnv({
      AI_GATEWAY_API_KEY: 'sk-gateway-key',
      AI_GATEWAY_BASE_URL: 'https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic///',
    });
    const result = buildEnvVars(env);
    expect(result.AI_GATEWAY_BASE_URL).toBe(
      'https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic',
    );
  });

  it('falls back to ANTHROPIC_BASE_URL when no AI_GATEWAY_BASE_URL', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'direct-key',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    });
    const result = buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('direct-key');
    expect(result.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com');
  });

  // Gateway token mapping
  it('maps MOLTBOT_GATEWAY_TOKEN to OPENCLAW_GATEWAY_TOKEN for container', () => {
    const env = createMockEnv({ MOLTBOT_GATEWAY_TOKEN: 'my-token' });
    const result = buildEnvVars(env);
    expect(result.OPENCLAW_GATEWAY_TOKEN).toBe('my-token');
  });

  // Channel tokens
  it('includes all channel tokens when set', () => {
    const env = createMockEnv({
      TELEGRAM_BOT_TOKEN: 'tg-token',
      TELEGRAM_DM_POLICY: 'pairing',
      DISCORD_BOT_TOKEN: 'discord-token',
      DISCORD_DM_POLICY: 'open',
      SLACK_BOT_TOKEN: 'slack-bot',
      SLACK_APP_TOKEN: 'slack-app',
    });
    const result = buildEnvVars(env);

    expect(result.TELEGRAM_BOT_TOKEN).toBe('tg-token');
    expect(result.TELEGRAM_DM_POLICY).toBe('pairing');
    expect(result.DISCORD_BOT_TOKEN).toBe('discord-token');
    expect(result.DISCORD_DM_POLICY).toBe('open');
    expect(result.SLACK_BOT_TOKEN).toBe('slack-bot');
    expect(result.SLACK_APP_TOKEN).toBe('slack-app');
  });

  it('maps DEV_MODE to OPENCLAW_DEV_MODE for container', () => {
    const env = createMockEnv({
      DEV_MODE: 'true',
    });
    const result = buildEnvVars(env);
    expect(result.OPENCLAW_DEV_MODE).toBe('true');
  });

  // AI Gateway model override
  it('passes CF_AI_GATEWAY_MODEL to container', () => {
    const env = createMockEnv({
      CF_AI_GATEWAY_MODEL: 'workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    });
    const result = buildEnvVars(env);
    expect(result.CF_AI_GATEWAY_MODEL).toBe('workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  });

  it('passes CF_ACCOUNT_ID to container', () => {
    const env = createMockEnv({ CF_ACCOUNT_ID: 'acct-123' });
    const result = buildEnvVars(env);
    expect(result.CF_ACCOUNT_ID).toBe('acct-123');
  });

  it('combines all env vars correctly', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-key',
      MOLTBOT_GATEWAY_TOKEN: 'token',
      TELEGRAM_BOT_TOKEN: 'tg',
    });
    const result = buildEnvVars(env);

    expect(result).toEqual({
      ANTHROPIC_API_KEY: 'sk-key',
      OPENCLAW_GATEWAY_TOKEN: 'token',
      TELEGRAM_BOT_TOKEN: 'tg',
    });
  });

  // ── AI Provider Priority ──────────────────────────────────────────
  // Provider precedence for container env:
  //   CF Gateway > Anthropic > OpenAI
  //   Legacy AI_GATEWAY_* overrides direct Anthropic key
  describe('AI provider priority selection', () => {
    it('passes only Cloudflare AI Gateway vars when only gateway configured', () => {
      const env = createMockEnv({
        CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-key',
        CF_AI_GATEWAY_ACCOUNT_ID: 'account',
        CF_AI_GATEWAY_GATEWAY_ID: 'gateway',
      });
      const result = buildEnvVars(env);
      expect(result.CLOUDFLARE_AI_GATEWAY_API_KEY).toBe('cf-key');
      expect(result.CF_AI_GATEWAY_ACCOUNT_ID).toBe('account');
      expect(result.CF_AI_GATEWAY_GATEWAY_ID).toBe('gateway');
      // No Anthropic or OpenAI keys
      expect(result.ANTHROPIC_API_KEY).toBeUndefined();
      expect(result.OPENAI_API_KEY).toBeUndefined();
    });

    it('passes only Anthropic key when only Anthropic configured', () => {
      const env = createMockEnv({
        ANTHROPIC_API_KEY: 'sk-anthro',
      });
      const result = buildEnvVars(env);
      expect(result.ANTHROPIC_API_KEY).toBe('sk-anthro');
      expect(result.OPENAI_API_KEY).toBeUndefined();
      expect(result.CLOUDFLARE_AI_GATEWAY_API_KEY).toBeUndefined();
    });

    it('passes only OpenAI key when only OpenAI configured', () => {
      const env = createMockEnv({
        OPENAI_API_KEY: 'sk-openai',
      });
      const result = buildEnvVars(env);
      expect(result.OPENAI_API_KEY).toBe('sk-openai');
      expect(result.ANTHROPIC_API_KEY).toBeUndefined();
      expect(result.CLOUDFLARE_AI_GATEWAY_API_KEY).toBeUndefined();
    });

    it('CF Gateway + Anthropic: both keys forwarded (gateway takes precedence at runtime)', () => {
      const env = createMockEnv({
        CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-key',
        CF_AI_GATEWAY_ACCOUNT_ID: 'account',
        CF_AI_GATEWAY_GATEWAY_ID: 'gateway',
        ANTHROPIC_API_KEY: 'sk-anthro',
      });
      const result = buildEnvVars(env);
      // Both forwarded - openclaw runtime uses CF Gateway when present
      expect(result.CLOUDFLARE_AI_GATEWAY_API_KEY).toBe('cf-key');
      expect(result.ANTHROPIC_API_KEY).toBe('sk-anthro');
    });

    it('legacy gateway overrides direct Anthropic key in env vars', () => {
      const env = createMockEnv({
        AI_GATEWAY_API_KEY: 'legacy-key',
        AI_GATEWAY_BASE_URL: 'https://gateway.example.com/anthropic',
        ANTHROPIC_API_KEY: 'direct-key',
      });
      const result = buildEnvVars(env);
      // Legacy gateway overrides ANTHROPIC_API_KEY
      expect(result.ANTHROPIC_API_KEY).toBe('legacy-key');
      expect(result.ANTHROPIC_BASE_URL).toBe('https://gateway.example.com/anthropic');
    });

    it('legacy gateway requires both key and URL (only key = no override)', () => {
      const env = createMockEnv({
        AI_GATEWAY_API_KEY: 'legacy-key',
        // No AI_GATEWAY_BASE_URL
        ANTHROPIC_API_KEY: 'direct-key',
      });
      const result = buildEnvVars(env);
      // Without base URL, legacy gateway is not activated
      expect(result.ANTHROPIC_API_KEY).toBe('direct-key');
      expect(result.AI_GATEWAY_BASE_URL).toBeUndefined();
    });

    it('legacy gateway requires both key and URL (only URL = no override)', () => {
      const env = createMockEnv({
        AI_GATEWAY_BASE_URL: 'https://gateway.example.com/anthropic',
        // No AI_GATEWAY_API_KEY
        ANTHROPIC_API_KEY: 'direct-key',
      });
      const result = buildEnvVars(env);
      // Without API key, legacy gateway is not activated
      expect(result.ANTHROPIC_API_KEY).toBe('direct-key');
      expect(result.AI_GATEWAY_BASE_URL).toBeUndefined();
    });

    it('all providers configured: all keys forwarded', () => {
      const env = createMockEnv({
        CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-key',
        CF_AI_GATEWAY_ACCOUNT_ID: 'account',
        CF_AI_GATEWAY_GATEWAY_ID: 'gateway',
        ANTHROPIC_API_KEY: 'sk-anthro',
        OPENAI_API_KEY: 'sk-openai',
      });
      const result = buildEnvVars(env);
      expect(result.CLOUDFLARE_AI_GATEWAY_API_KEY).toBe('cf-key');
      expect(result.ANTHROPIC_API_KEY).toBe('sk-anthro');
      expect(result.OPENAI_API_KEY).toBe('sk-openai');
    });

    it('passes CDP_SECRET and WORKER_URL when set', () => {
      const env = createMockEnv({
        CDP_SECRET: 'cdp-secret-value',
        WORKER_URL: 'https://my-worker.workers.dev',
      });
      const result = buildEnvVars(env);
      expect(result.CDP_SECRET).toBe('cdp-secret-value');
      expect(result.WORKER_URL).toBe('https://my-worker.workers.dev');
    });
  });
});

// ── Startup-level AI Provider Priority (mirrors start-openclaw.sh) ──────────
// These tests validate the auth-choice that start-openclaw.sh would use
// when running `openclaw onboard`. The priority chain:
//   CF Gateway (all 3 vars) > Anthropic > OpenAI > none
describe('resolveStartupAuthChoice', () => {
  it('returns "none" when no provider configured', () => {
    const env = createMockEnv();
    expect(resolveStartupAuthChoice(env)).toBe('none');
  });

  // ── Scenario 1: CF Gateway full set ──
  it('selects CF Gateway when all three CF Gateway vars are present', () => {
    const env = createMockEnv({
      CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-key',
      CF_AI_GATEWAY_ACCOUNT_ID: 'account',
      CF_AI_GATEWAY_GATEWAY_ID: 'gateway',
    });
    expect(resolveStartupAuthChoice(env)).toBe('cloudflare-ai-gateway-api-key');
  });

  it('CF Gateway wins even when Anthropic and OpenAI are also set', () => {
    const env = createMockEnv({
      CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-key',
      CF_AI_GATEWAY_ACCOUNT_ID: 'account',
      CF_AI_GATEWAY_GATEWAY_ID: 'gateway',
      ANTHROPIC_API_KEY: 'sk-anthro',
      OPENAI_API_KEY: 'sk-openai',
    });
    expect(resolveStartupAuthChoice(env)).toBe('cloudflare-ai-gateway-api-key');
  });

  it('incomplete CF Gateway (missing account ID) falls through', () => {
    const env = createMockEnv({
      CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-key',
      // CF_AI_GATEWAY_ACCOUNT_ID missing
      CF_AI_GATEWAY_GATEWAY_ID: 'gateway',
      ANTHROPIC_API_KEY: 'sk-anthro',
    });
    // Falls through to Anthropic
    expect(resolveStartupAuthChoice(env)).toBe('apiKey');
  });

  // ── Scenario 2: Anthropic only ──
  it('selects Anthropic when only Anthropic key is set', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-anthro',
    });
    expect(resolveStartupAuthChoice(env)).toBe('apiKey');
  });

  it('Anthropic wins over OpenAI (priority order)', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-anthro',
      OPENAI_API_KEY: 'sk-openai',
    });
    expect(resolveStartupAuthChoice(env)).toBe('apiKey');
  });

  // ── Scenario 3: OpenAI only ──
  it('selects OpenAI when only OpenAI key is set', () => {
    const env = createMockEnv({
      OPENAI_API_KEY: 'sk-openai',
    });
    expect(resolveStartupAuthChoice(env)).toBe('openai-api-key');
  });

  // ── Scenario 4: Legacy gateway override ──
  // Legacy AI_GATEWAY_* vars are mapped to ANTHROPIC_API_KEY by buildEnvVars
  // before the container starts. The startup script then sees ANTHROPIC_API_KEY.
  it('legacy gateway: buildEnvVars maps to Anthropic, startup picks apiKey', () => {
    const env = createMockEnv({
      AI_GATEWAY_API_KEY: 'legacy-key',
      AI_GATEWAY_BASE_URL: 'https://gateway.example.com/anthropic',
    });
    // buildEnvVars transforms legacy → ANTHROPIC_API_KEY
    const containerEnv = buildEnvVars(env);
    expect(containerEnv.ANTHROPIC_API_KEY).toBe('legacy-key');
    expect(containerEnv.ANTHROPIC_BASE_URL).toBe('https://gateway.example.com/anthropic');

    // After buildEnvVars, the container env has ANTHROPIC_API_KEY set,
    // so resolveStartupAuthChoice (on the container env) would pick 'apiKey'.
    // We simulate this by creating a mock env with the remapped vars:
    const containerMockEnv = createMockEnv({
      ANTHROPIC_API_KEY: containerEnv.ANTHROPIC_API_KEY,
    });
    expect(resolveStartupAuthChoice(containerMockEnv)).toBe('apiKey');
  });

  // ── Consistency: buildEnvVars + resolveStartupAuthChoice agree ──
  it('consistency: buildEnvVars forwards CF Gateway vars when resolveStartupAuthChoice picks CF Gateway', () => {
    const env = createMockEnv({
      CLOUDFLARE_AI_GATEWAY_API_KEY: 'cf-key',
      CF_AI_GATEWAY_ACCOUNT_ID: 'account',
      CF_AI_GATEWAY_GATEWAY_ID: 'gateway',
    });
    expect(resolveStartupAuthChoice(env)).toBe('cloudflare-ai-gateway-api-key');
    const vars = buildEnvVars(env);
    expect(vars.CLOUDFLARE_AI_GATEWAY_API_KEY).toBe('cf-key');
    expect(vars.CF_AI_GATEWAY_ACCOUNT_ID).toBe('account');
    expect(vars.CF_AI_GATEWAY_GATEWAY_ID).toBe('gateway');
  });

  it('consistency: buildEnvVars forwards Anthropic key when resolveStartupAuthChoice picks apiKey', () => {
    const env = createMockEnv({ ANTHROPIC_API_KEY: 'sk-anthro' });
    expect(resolveStartupAuthChoice(env)).toBe('apiKey');
    const vars = buildEnvVars(env);
    expect(vars.ANTHROPIC_API_KEY).toBe('sk-anthro');
  });

  it('consistency: buildEnvVars forwards OpenAI key when resolveStartupAuthChoice picks openai-api-key', () => {
    const env = createMockEnv({ OPENAI_API_KEY: 'sk-openai' });
    expect(resolveStartupAuthChoice(env)).toBe('openai-api-key');
    const vars = buildEnvVars(env);
    expect(vars.OPENAI_API_KEY).toBe('sk-openai');
  });
});
