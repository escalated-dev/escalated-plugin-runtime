import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The JSON-RPC id of the host call (action, filter, endpoint, webhook, cron,
 * badge, activate, deactivate) whose handler is running. Every ctx.* request a
 * handler makes carries it as `host_call_id`, so a host serving several calls
 * at once can tell which of its requests, and so which acting user, a ctx call
 * belongs to.
 */
export const hostCall = new AsyncLocalStorage<number | string>();
