import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

it('carries the versioned HTTP contract through a real runtime process', async (t) => {
  const base = mkdtempSync(join(tmpdir(), 'escalated-http-contract-'));
  const plugin = join(base, 'plugins', 'echo');
  mkdirSync(plugin, { recursive: true });
  writeFileSync(join(plugin, 'package.json'), JSON.stringify({ type: 'module', main: 'index.js' }));
  writeFileSync(join(plugin, 'index.js'), `
    const handler = async (_ctx, req) => ({ __escalated_http: 1, status: 401,
      format: 'json', headers: { 'cache-control': 'no-store' }, body: {
        raw: req.rawBody ? Buffer.from(req.rawBody).toString('base64') : null,
        version: req.httpContract ?? null, headers: req.headers,
        params: req.params, query: req.query, clientIp: req.clientIp, parsed: req.body,
      }});
    export default { name: 'echo', version: '0.1.0', __escalated: true,
      _normalizedEndpoints: { 'POST /echo': { handler } },
      webhooks: { 'POST /echo': handler }, toManifest: () => ({ name: 'echo' }) };
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
    // base comes directly from mkdtemp under the OS temporary directory.
    rmSync(base, { recursive: true, force: true });
  });
  let nextId = 0;
  const call = (method: string, params: unknown): Promise<any> => new Promise((accept, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { lines.off('line', receive); reject(new Error('Runtime did not respond: ' + errors)); }, 5000);
    const receive = (line: string) => {
      const response = JSON.parse(line);
      if (response.id !== id) return;
      clearTimeout(timer);
      lines.off('line', receive);
      accept(response);
    };
    lines.on('line', receive);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const handshake = await call('handshake', { protocol_version: '1.0' });
  assert.deepEqual(handshake.result.http_contract_versions, [1]);
  const raw = Buffer.from(' {"text" : "📦"}\r\n').toString('base64');
  const params = { plugin: 'echo', method: 'POST', path: '/echo', httpContract: 1, rawBodyBase64: raw,
    headers: { 'X-Slack-Signature': ['v0=signature'] }, body: { text: 'parsed' },
    params: { id: 'route' }, query: { id: 'query' }, clientIp: '192.0.2.1' };
  for (const method of ['endpoint', 'webhook']) {
    const response = (await call(method, params)).result;
    assert.equal(response.__escalated_http, 1);
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { raw, version: 1, headers: { 'x-slack-signature': 'v0=signature' },
      params: { id: 'route' }, query: { id: 'query' }, clientIp: '192.0.2.1', parsed: { text: 'parsed' } });
    assert.equal((await call(method, { ...params, rawBodyBase64: 'invalid' })).error.code, -32000);
  }
  const legacy = await call('webhook', { plugin: 'echo', method: 'POST', path: '/echo', body: { text: 'old' } });
  assert.equal(legacy.result.body.raw, null);
  assert.equal(legacy.result.body.version, null);
  // Finished requests must release their 30/60-second timeout handles.
  const closed = once(child, 'close');
  child.stdin.end();
  let timer: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([closed, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Completed HTTP requests kept the runtime alive')), 3000);
    })]);
  } finally {
    clearTimeout(timer!);
  }
});
