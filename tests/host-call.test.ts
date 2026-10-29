import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createContextProxy } from '../src/context-proxy.js';
import { hostCall } from '../src/host-call.js';

it('stamps a ctx call with the id of the host call it serves, and nothing outside one', async () => {
  const sent: Array<Record<string, unknown>> = [];
  const ctx = createContextProxy('crm', async (_method, params) => {
    sent.push(params as Record<string, unknown>);
    return null;
  });

  await hostCall.run(7, () => ctx.tickets.find(1));
  await ctx.tickets.find(2);

  assert.deepStrictEqual(sent[0], { plugin: 'crm', id: 1, host_call_id: 7 });
  assert.deepStrictEqual(sent[1], { plugin: 'crm', id: 2 });
});

it('keeps concurrent host calls apart in a real runtime process', async (t) => {
  const base = mkdtempSync(join(tmpdir(), 'escalated-host-call-'));
  const plugin = join(base, 'plugins', 'crm');
  mkdirSync(plugin, { recursive: true });
  writeFileSync(join(plugin, 'package.json'), JSON.stringify({ type: 'module', main: 'index.js' }));
  // Each endpoint asks the host who is signed in, waits, then asks again, so
  // the two calls' ctx requests interleave.
  writeFileSync(join(plugin, 'index.js'), `
    const handler = async (ctx) => {
      const first = await ctx.currentUser();
      await new Promise((r) => setTimeout(r, 20));
      const second = await ctx.currentUser();
      return { first, second };
    };
    export default { name: 'crm', version: '0.1.0', __escalated: true,
      _normalizedEndpoints: { 'GET /who': { handler } }, webhooks: {},
      actions: { 'ticket.created': async (_event, ctx) => { await ctx.currentUser(); } },
      toManifest: () => ({ name: 'crm' }) };
  `);
  const child = spawn(process.execPath, [resolve('build/bin/escalated-plugins.js'), base], { stdio: 'pipe', windowsHide: true });
  let errors = '';
  child.stderr.on('data', (data) => { errors += data.toString(); });
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

  // The host: answers ctx.currentUser with the user of the host call named
  // by host_call_id, and records what each ctx call carried.
  const users: Record<number, string> = { 1: 'alice', 2: 'bob', 3: 'carol' };
  const seen: Array<unknown> = [];
  const waiting = new Map<number, (message: any) => void>();
  lines.on('line', (line) => {
    const message = JSON.parse(line);
    if (message.method) {
      seen.push(message.params.host_call_id);
      const user = users[message.params.host_call_id] ?? null;
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: user && { name: user } }) + '\n');
      return;
    }
    waiting.get(message.id)?.(message);
  });
  const call = (id: number, method: string, params: unknown): Promise<any> =>
    new Promise((accept, reject) => {
      const timer = setTimeout(() => reject(new Error('Runtime did not respond: ' + errors)), 5000);
      waiting.set(id, (message) => {
        clearTimeout(timer);
        accept(message);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });

  const handshake = await call(100, 'handshake', { protocol_version: '1.0' });
  assert.equal(handshake.result.host_call_ids, true);

  const [alice, bob] = await Promise.all([
    call(1, 'endpoint', { plugin: 'crm', method: 'GET', path: '/who' }),
    call(2, 'endpoint', { plugin: 'crm', method: 'GET', path: '/who' }),
  ]);
  assert.deepEqual(alice.result, { first: { name: 'alice' }, second: { name: 'alice' } });
  assert.deepEqual(bob.result, { first: { name: 'bob' }, second: { name: 'bob' } });

  seen.length = 0;
  await call(3, 'action', { hook: 'ticket.created', event: {} });
  assert.deepEqual(seen, [3]);
});
