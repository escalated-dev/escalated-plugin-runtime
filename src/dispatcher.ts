import type { ResolvedPlugin } from '@escalated-dev/plugin-sdk';
import type { PluginContext, EndpointRequest } from '@escalated-dev/plugin-sdk';

interface DispatcherOptions {
  actionTimeout?: number;
  filterTimeout?: number;
  endpointTimeout?: number;
  webhookTimeout?: number;
}

interface RegisteredFilter {
  pluginName: string;
  priority: number;
  handler: (value: unknown, ctx: PluginContext) => unknown | Promise<unknown>;
  ctx: PluginContext;
}

interface RegisteredAction {
  pluginName: string;
  handler: (event: unknown, ctx: PluginContext) => void | Promise<void>;
  ctx: PluginContext;
}

interface RegisteredEndpoint {
  handler: (ctx: PluginContext, req: EndpointRequest) => Promise<unknown>;
  ctx: PluginContext;
}

export class Dispatcher {
  private actions = new Map<string, RegisteredAction[]>();
  private filters = new Map<string, RegisteredFilter[]>();
  private endpoints = new Map<string, RegisteredEndpoint>(); // key: "pluginName:METHOD /path"
  private webhooks = new Map<string, RegisteredEndpoint>();
  private options: Required<DispatcherOptions>;

  constructor(options: DispatcherOptions = {}) {
    this.options = {
      actionTimeout: options.actionTimeout ?? 30_000,
      filterTimeout: options.filterTimeout ?? 5_000,
      endpointTimeout: options.endpointTimeout ?? 30_000,
      webhookTimeout: options.webhookTimeout ?? 60_000,
    };
  }

  register(plugin: ResolvedPlugin, ctx: PluginContext): void {
    // Register actions
    for (const [hook, handler] of Object.entries(plugin.actions ?? {})) {
      if (!this.actions.has(hook)) this.actions.set(hook, []);
      this.actions.get(hook)!.push({ pluginName: plugin.name, handler, ctx });
    }

    // Register filters (normalized)
    for (const [hook, def] of Object.entries(plugin._normalizedFilters ?? {})) {
      if (!this.filters.has(hook)) this.filters.set(hook, []);
      this.filters.get(hook)!.push({
        pluginName: plugin.name,
        priority: def.priority ?? 10,
        handler: def.handler,
        ctx,
      });
      // Sort by priority
      this.filters.get(hook)!.sort((a, b) => a.priority - b.priority);
    }

    // Register endpoints
    for (const [key, ep] of Object.entries(plugin._normalizedEndpoints ?? {})) {
      this.endpoints.set(`${plugin.name}:${key}`, { handler: ep.handler, ctx });
    }

    // Register webhooks
    for (const [key, handler] of Object.entries(plugin.webhooks ?? {})) {
      this.webhooks.set(`${plugin.name}:${key}`, { handler, ctx });
    }
  }

  async dispatchAction(hook: string, event: unknown, active?: ActivePlugins): Promise<void> {
    const handlers = (this.actions.get(hook) ?? []).filter((h) => isActive(h.pluginName, active));
    await Promise.allSettled(handlers.map((h) => withTimeout(h.handler(event, h.ctx), this.options.actionTimeout)));
  }

  async applyFilter<T>(hook: string, value: T, active?: ActivePlugins): Promise<T> {
    const handlers = (this.filters.get(hook) ?? []).filter((h) => isActive(h.pluginName, active));
    let current: unknown = value;

    for (const h of handlers) {
      try {
        current = await withTimeout(h.handler(current, h.ctx), this.options.filterTimeout);
      } catch {
        // On timeout or error, skip this filter but continue to the next
        // (a slow Plugin A should not prevent Plugin B from running)
        continue;
      }
    }

    return current as T;
  }

  async callEndpoint(
    pluginName: string,
    method: string,
    path: string,
    req: EndpointRequest,
    active?: ActivePlugins,
  ): Promise<unknown> {
    assertActive(pluginName, active);
    const key = `${pluginName}:${method} ${path}`;
    const ep = this.endpoints.get(key);
    if (!ep) throw new Error(`Endpoint not found: ${key}`);
    return withTimeout(ep.handler(ep.ctx, req), this.options.endpointTimeout);
  }

  async callWebhook(
    pluginName: string,
    method: string,
    path: string,
    req: EndpointRequest,
    active?: ActivePlugins,
  ): Promise<unknown> {
    assertActive(pluginName, active);
    const key = `${pluginName}:${method} ${path}`;
    const wh = this.webhooks.get(key);
    if (!wh) throw new Error(`Webhook not found: ${key}`);
    return withTimeout(wh.handler(wh.ctx, req), this.options.webhookTimeout);
  }
}

/**
 * The names of the plugins the host has active, as it sends them on a call
 * (`plugins`). `undefined` means the host sent no list (an older host): every
 * loaded plugin is treated as active, as before.
 */
export type ActivePlugins = readonly string[] | undefined;

export function isActive(pluginName: string, active: ActivePlugins): boolean {
  return active === undefined || active.includes(pluginName);
}

function assertActive(pluginName: string, active: ActivePlugins): void {
  if (!isActive(pluginName, active)) throw new Error(`Plugin is not active: ${pluginName}`);
}

/** Reads the `plugins` list from call params; anything but an array of strings is no list. */
export function activePlugins(params: { plugins?: unknown } | undefined): ActivePlugins {
  const list = params?.plugins;
  if (!Array.isArray(list)) return undefined;
  return list.filter((name): name is string => typeof name === 'string');
}

function withTimeout<T>(promise: T | Promise<T>, ms: number): Promise<T> {
  if (!(promise instanceof Promise)) return Promise.resolve(promise);
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
