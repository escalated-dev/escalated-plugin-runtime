import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createContextProxy } from '../src/context-proxy.js';

describe('createContextProxy', () => {
    it('proxies config.all() to JSON-RPC request', async () => {
        const sendRequest = mock.fn(async () => ({ token: 'abc' }));
        const ctx = createContextProxy('test-plugin', sendRequest);

        const result = await ctx.config.all();
        assert.deepStrictEqual(result, { token: 'abc' });
        assert.strictEqual(sendRequest.mock.calls[0]!.arguments[0], 'ctx.config.all');
        assert.deepStrictEqual(sendRequest.mock.calls[0]!.arguments[1], { plugin: 'test-plugin' });
    });

    it('proxies tickets.find() to JSON-RPC request', async () => {
        const sendRequest = mock.fn(async () => ({ id: 1, title: 'Help' }));
        const ctx = createContextProxy('test-plugin', sendRequest);

        const ticket = await ctx.tickets.find(1);
        assert.strictEqual(sendRequest.mock.calls[0]!.arguments[0], 'ctx.tickets.find');
        assert.deepStrictEqual(sendRequest.mock.calls[0]!.arguments[1], { plugin: 'test-plugin', id: 1 });
    });

    it('proxies store.query() with filter and options', async () => {
        const sendRequest = mock.fn(async () => [{ id: 1 }]);
        const ctx = createContextProxy('test-plugin', sendRequest);

        await ctx.store.query('links', { ticket_id: 1 }, { limit: 10 });
        assert.deepStrictEqual(sendRequest.mock.calls[0]!.arguments[1], {
            plugin: 'test-plugin',
            collection: 'links',
            filter: { ticket_id: 1 },
            options: { limit: 10 },
        });
    });

    it('proxies emit() to JSON-RPC request', async () => {
        const sendRequest = mock.fn(async () => undefined);
        const ctx = createContextProxy('test-plugin', sendRequest);

        await ctx.emit('jira.issue.created', { issueKey: 'PROJ-1' });
        assert.strictEqual(sendRequest.mock.calls[0]!.arguments[0], 'ctx.emit');
    });

    it('proxies broadcast.toTicket() to JSON-RPC request', async () => {
        const sendRequest = mock.fn(async () => undefined);
        const ctx = createContextProxy('test-plugin', sendRequest);

        await ctx.broadcast.toTicket(1, 'updated', { status: 'open' });
        assert.strictEqual(sendRequest.mock.calls[0]!.arguments[0], 'ctx.broadcast.toTicket');
    });
});
