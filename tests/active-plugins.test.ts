import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Dispatcher } from '../src/dispatcher.js';
import { definePlugin } from '@escalated-dev/plugin-sdk';
import type { PluginContext } from '@escalated-dev/plugin-sdk';

const ctx = {} as PluginContext;

function plugins(calls: string[]) {
  return ['on', 'off'].map((name) =>
    definePlugin({
      name,
      version: '1.0.0',
      actions: { 'ticket.created': () => void calls.push(name) },
      filters: { channels: { handler: (v: string[]) => [...v, name] } },
      endpoints: { 'GET /x': async () => name },
      webhooks: { 'POST /x': async () => name },
    }),
  );
}

describe('Dispatcher active-plugin list', () => {
  it('runs only listed plugins for actions and filters', async () => {
    const calls: string[] = [];
    const d = new Dispatcher();
    for (const p of plugins(calls)) d.register(p, ctx);

    await d.dispatchAction('ticket.created', {}, ['on']);
    assert.deepStrictEqual(calls, ['on']);
    assert.deepStrictEqual(await d.applyFilter('channels', [], ['on']), ['on']);
  });

  it('runs nothing for an empty list', async () => {
    const calls: string[] = [];
    const d = new Dispatcher();
    for (const p of plugins(calls)) d.register(p, ctx);

    await d.dispatchAction('ticket.created', {}, []);
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(await d.applyFilter('channels', ['email'], []), ['email']);
  });

  it('runs every plugin when no list is sent', async () => {
    const calls: string[] = [];
    const d = new Dispatcher();
    for (const p of plugins(calls)) d.register(p, ctx);

    await d.dispatchAction('ticket.created', {});
    assert.deepStrictEqual(calls.sort(), ['off', 'on']);
    assert.deepStrictEqual(await d.applyFilter('channels', []), ['on', 'off']);
  });

  it('refuses an endpoint or webhook of an unlisted plugin', async () => {
    const d = new Dispatcher();
    for (const p of plugins([])) d.register(p, ctx);
    const req = { body: null, params: {}, query: {}, headers: {} };

    assert.equal(await d.callEndpoint('on', 'GET', '/x', req, ['on']), 'on');
    await assert.rejects(d.callEndpoint('off', 'GET', '/x', req, ['on']), /not active/);
    await assert.rejects(d.callWebhook('off', 'POST', '/x', req, ['on']), /not active/);
    assert.equal(await d.callWebhook('off', 'POST', '/x', req), 'off');
  });
});

it('honours the plugins list a host sends to a real runtime process', async (t) => {
  const base = mkdtempSync(join(tmpdir(), 'escalated-active-plugins-'));
  for (const name of ['on', 'off']) {
    const dir = join(base, 'plugins', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module', main: 'index.js' }));
    writeFileSync(
      join(dir, 'index.js'),
      `
      export default { name: '${name}', version: '0.1.0', __escalated: true,
        actions: { 'ticket.created': async (_e, ctx) => { await ctx.log.info('${name}'); } },
        _normalizedFilters: { channels: { priority: 10, handler: (v) => [...v, '${name}'] } },
        _normalizedEndpoints: {}, webhooks: {},
        cron: { '* * * * *': async (ctx) => { await ctx.log.info('cron ${name}'); } },
        widgets: [{ component: 'W', badge: async () => 3 }],
        toManifest: () => ({ name: '${name}' }) };
    `,
    );
  }
  const child = spawn(process.execPath, [resolve('build/bin/escalated-plugins.js'), base], {
    stdio: 'pipe',
    windowsHide: true,
  });
  let errors = '';
  child.stderr.on('data', (data) => {
    errors += data.toString();
  });
  const lines = createInterface({ input: child.stdout });
  t.after(async () => {
    lines.close();
    if (child.exitCode === null) {
      const closed = once(child, 'close');
      child.kill();
      await closed;
    }
    rmSync(base, { recursive: true, force: true });
  });

  const logged: string[] = [];
  const waiting = new Map<number, (message: any) => void>();
  lines.on('line', (line) => {
    const message = JSON.parse(line);
    if (message.method) {
      logged.push(message.params.message);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: null }) + '\n');
      return;
    }
    waiting.get(message.id)?.(message);
  });
  let nextId = 0;
  const call = (method: string, params: unknown): Promise<any> =>
    new Promise((accept, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => reject(new Error('Runtime did not respond: ' + errors)), 5000);
      waiting.set(id, (message) => {
        clearTimeout(timer);
        accept(message);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });

  const handshake = await call('handshake', { protocol_version: '1.0' });
  assert.equal(handshake.result.active_plugin_lists, true);

  await call('action', { hook: 'ticket.created', event: {}, plugins: ['on'] });
  assert.deepEqual(logged, ['on']);

  const filtered = await call('filter', { hook: 'channels', value: [], plugins: ['on'] });
  assert.deepEqual(filtered.result, ['on']);

  logged.length = 0;
  await call('cron', { plugin: 'off', schedule: '* * * * *', plugins: ['on'] });
  assert.deepEqual(logged, []);
  assert.equal((await call('badge', { plugin: 'off', component: 'W', plugins: ['on'] })).result, null);
  assert.equal((await call('badge', { plugin: 'on', component: 'W', plugins: ['on'] })).result, 3);

  // A host that sends no list keeps the old behaviour: every plugin runs.
  await call('action', { hook: 'ticket.created', event: {} });
  assert.deepEqual(logged.sort(), ['off', 'on']);
  const all = await call('filter', { hook: 'channels', value: [] });
  assert.deepEqual(all.result.sort(), ['off', 'on']);
});
