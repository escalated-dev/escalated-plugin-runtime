import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JsonRpcHandler } from '../src/json-rpc.js';
import { Readable, Writable } from 'node:stream';

function createMockStreams() {
    const written: string[] = [];
    const input = new Readable({ read() {} });
    const output = new Writable({
        write(chunk, _enc, cb) {
            written.push(chunk.toString());
            cb();
        },
    });
    return { input, output, written };
}

describe('JsonRpcHandler', () => {
    it('parses incoming JSON-RPC messages', async () => {
        const { input, output } = createMockStreams();
        const handler = new JsonRpcHandler(input, output);
        const messages: any[] = [];
        handler.onMessage((msg) => messages.push(msg));
        handler.start();

        input.push(JSON.stringify({ jsonrpc: '2.0', method: 'action', params: { hook: 'test' }, id: 1 }) + '\n');

        await new Promise((r) => setTimeout(r, 50));

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0]!.method, 'action');
        handler.stop();
    });

    it('sends JSON-RPC responses', () => {
        const { input, output, written } = createMockStreams();
        const handler = new JsonRpcHandler(input, output);

        handler.sendResponse(1, { ok: true });

        const parsed = JSON.parse(written[0]!);
        assert.strictEqual(parsed.jsonrpc, '2.0');
        assert.strictEqual(parsed.id, 1);
        assert.deepStrictEqual(parsed.result, { ok: true });
    });

    it('sends JSON-RPC requests and resolves responses', async () => {
        const { input, output, written } = createMockStreams();
        const handler = new JsonRpcHandler(input, output);
        handler.start();

        const promise = handler.sendRequest('ctx.config.all', { plugin: 'test' });

        // Simulate host responding
        await new Promise((r) => setTimeout(r, 10));
        const request = JSON.parse(written[0]!);
        input.push(JSON.stringify({ jsonrpc: '2.0', result: { token: 'abc' }, id: request.id }) + '\n');

        const result = await promise;
        assert.deepStrictEqual(result, { token: 'abc' });
        handler.stop();
    });

    it('sends JSON-RPC error responses', () => {
        const { input, output, written } = createMockStreams();
        const handler = new JsonRpcHandler(input, output);

        handler.sendError(1, -32000, 'Something went wrong');

        const parsed = JSON.parse(written[0]!);
        assert.strictEqual(parsed.error.code, -32000);
        assert.strictEqual(parsed.error.message, 'Something went wrong');
    });
});
