import type { PluginContext, HttpClient } from '@escalated-dev/plugin-sdk';

type RpcSender = (method: string, params?: unknown) => Promise<unknown>;

/**
 * Creates a PluginContext that proxies all calls to the host via JSON-RPC.
 * ctx.http is the exception — it runs in-process using fetch().
 */
export function createContextProxy(pluginName: string, sendRequest: RpcSender): PluginContext {
  const rpc = (method: string, params?: Record<string, unknown>) =>
    sendRequest(method, { plugin: pluginName, ...params });

  return {
    config: {
      get: (key) => rpc('ctx.config.get', { key }) as Promise<unknown>,
      set: (data) => rpc('ctx.config.set', { data }) as Promise<void>,
      all: () => rpc('ctx.config.all') as Promise<Record<string, unknown>>,
    },
    store: {
      get: (collection, key) => rpc('ctx.store.get', { collection, key }),
      set: (collection, key, value) => rpc('ctx.store.set', { collection, key, value }) as Promise<void>,
      query: (collection, filter, options) =>
        rpc('ctx.store.query', { collection, filter, options }) as Promise<unknown[]>,
      insert: (collection, data) => rpc('ctx.store.insert', { collection, data }),
      update: (collection, key, data) => rpc('ctx.store.update', { collection, key, data }),
      delete: (collection, key) => rpc('ctx.store.delete', { collection, key }) as Promise<void>,
    },
    http: createHttpClient(),
    broadcast: {
      toChannel: (channel, event, data) => rpc('ctx.broadcast.toChannel', { channel, event, data }) as Promise<void>,
      toUser: (userId, event, data) => rpc('ctx.broadcast.toUser', { userId, event, data }) as Promise<void>,
      toTicket: (ticketId, event, data) => rpc('ctx.broadcast.toTicket', { ticketId, event, data }) as Promise<void>,
    },
    log: {
      info: (message, data) => {
        rpc('ctx.log', { level: 'info', message, data }).catch(() => {});
      },
      warn: (message, data) => {
        rpc('ctx.log', { level: 'warn', message, data }).catch(() => {});
      },
      error: (message, data) => {
        rpc('ctx.log', { level: 'error', message, data }).catch(() => {});
      },
      debug: (message, data) => {
        rpc('ctx.log', { level: 'debug', message, data }).catch(() => {});
      },
    },
    tickets: {
      find: (id) => rpc('ctx.tickets.find', { id }) as Promise<any>,
      query: (filter) => rpc('ctx.tickets.query', { filter }) as Promise<any>,
      create: (data) => rpc('ctx.tickets.create', { data }) as Promise<any>,
      update: (id, data) => rpc('ctx.tickets.update', { id, data }) as Promise<any>,
    },
    replies: {
      find: (id) => rpc('ctx.replies.find', { id }) as Promise<any>,
      query: (filter) => rpc('ctx.replies.query', { filter }) as Promise<any>,
      create: (data) => rpc('ctx.replies.create', { data }) as Promise<any>,
    },
    contacts: {
      find: (id) => rpc('ctx.contacts.find', { id }) as Promise<any>,
      findByEmail: (email) => rpc('ctx.contacts.findByEmail', { email }) as Promise<any>,
      create: (data) => rpc('ctx.contacts.create', { data }) as Promise<any>,
    },
    tags: {
      all: () => rpc('ctx.tags.all') as Promise<any>,
      create: (data) => rpc('ctx.tags.create', { data }) as Promise<any>,
    },
    departments: {
      all: () => rpc('ctx.departments.all') as Promise<any>,
      find: (id) => rpc('ctx.departments.find', { id }) as Promise<any>,
    },
    agents: {
      all: () => rpc('ctx.agents.all') as Promise<any>,
      find: (id) => rpc('ctx.agents.find', { id }) as Promise<any>,
    },
    emit: (hook, data) => rpc('ctx.emit', { hook, data }) as Promise<void>,
    currentUser: () => rpc('ctx.currentUser') as Promise<any>,
  };
}

function createHttpClient(): HttpClient {
  async function request(url: string, method: string, options?: any) {
    const fetchOptions: RequestInit = {
      method,
      headers: { ...options?.headers },
    };
    if (options?.json) {
      fetchOptions.body = JSON.stringify(options.json);
      (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
    } else if (options?.body) {
      fetchOptions.body = options.body;
    }
    if (options?.timeout) {
      fetchOptions.signal = AbortSignal.timeout(options.timeout);
    }
    const resp = await fetch(url, fetchOptions);
    return {
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
      json: () => resp.json(),
      text: () => resp.text(),
    };
  }

  return {
    get: (url, opts) => request(url, 'GET', opts),
    post: (url, opts) => request(url, 'POST', opts),
    put: (url, opts) => request(url, 'PUT', opts),
    delete: (url, opts) => request(url, 'DELETE', opts),
  };
}
