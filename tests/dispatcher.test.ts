import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher } from '../src/dispatcher.js';
import { definePlugin } from '@escalated-dev/plugin-sdk';
import type { PluginContext } from '@escalated-dev/plugin-sdk';

const mockCtx = {} as PluginContext;

describe('Dispatcher', () => {
  it('dispatches action to the correct plugin', async () => {
    const called = { value: false };
    const plugin = definePlugin({
      name: 'test',
      version: '1.0.0',
      actions: {
        'ticket.created': async () => {
          called.value = true;
        },
      },
    });

    const dispatcher = new Dispatcher();
    dispatcher.register(plugin, mockCtx);
    await dispatcher.dispatchAction('ticket.created', { id: 1 });

    assert.strictEqual(called.value, true);
  });

  it('chains filters in priority order', async () => {
    const pluginA = definePlugin({
      name: 'a',
      version: '1.0.0',
      filters: {
        channels: { priority: 5, handler: (v: string[]) => [...v, 'a'] },
      },
    });
    const pluginB = definePlugin({
      name: 'b',
      version: '1.0.0',
      filters: {
        channels: { priority: 20, handler: (v: string[]) => [...v, 'b'] },
      },
    });
    const pluginC = definePlugin({
      name: 'c',
      version: '1.0.0',
      filters: {
        channels: { priority: 10, handler: (v: string[]) => [...v, 'c'] },
      },
    });

    const dispatcher = new Dispatcher();
    dispatcher.register(pluginA, mockCtx);
    dispatcher.register(pluginB, mockCtx);
    dispatcher.register(pluginC, mockCtx);

    const result = await dispatcher.applyFilter('channels', []);
    assert.deepStrictEqual(result, ['a', 'c', 'b']); // Priority order: 5, 10, 20
  });

  it('calls endpoint handler', async () => {
    const plugin = definePlugin({
      name: 'test',
      version: '1.0.0',
      endpoints: {
        'GET /settings': async () => ({ key: 'value' }),
      },
    });

    const dispatcher = new Dispatcher();
    dispatcher.register(plugin, mockCtx);

    const result = await dispatcher.callEndpoint('test', 'GET', '/settings', {
      body: null,
      params: {},
      query: {},
      headers: {},
    });
    assert.deepStrictEqual(result, { key: 'value' });
  });

  it('calls webhook handler', async () => {
    const plugin = definePlugin({
      name: 'test',
      version: '1.0.0',
      webhooks: {
        'POST /events': async (_ctx, _req) => ({ received: true }),
      },
    });

    const dispatcher = new Dispatcher();
    dispatcher.register(plugin, mockCtx);

    const result = await dispatcher.callWebhook('test', 'POST', '/events', {
      body: { type: 'test' },
      params: {},
      query: {},
      headers: {},
    });
    assert.deepStrictEqual(result, { received: true });
  });

  it('skips timed-out filter but continues chain', async () => {
    const slow = definePlugin({
      name: 'slow',
      version: '1.0.0',
      filters: {
        channels: {
          priority: 10,
          handler: async (v: string[]) => {
            await new Promise((r) => setTimeout(r, 10000));
            return [...v, 'slow'];
          },
        },
      },
    });
    const fast = definePlugin({
      name: 'fast',
      version: '1.0.0',
      filters: {
        channels: { priority: 20, handler: (v: string[]) => [...v, 'fast'] },
      },
    });

    const dispatcher = new Dispatcher({ filterTimeout: 50 });
    dispatcher.register(slow, mockCtx);
    dispatcher.register(fast, mockCtx);

    const result = await dispatcher.applyFilter('channels', ['email']);
    // Slow plugin timed out and was skipped, but fast plugin still ran
    assert.deepStrictEqual(result, ['email', 'fast']);
  });
});
