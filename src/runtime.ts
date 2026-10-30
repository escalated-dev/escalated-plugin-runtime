import { JsonRpcHandler } from './json-rpc.js';
import { Dispatcher, activePlugins, isActive } from './dispatcher.js';
import { PluginLoader } from './plugin-loader.js';
import { createContextProxy } from './context-proxy.js';
import { decodeHttpRequest } from './http-request.js';
import { hostCall } from './host-call.js';
import type { ResolvedPlugin, PluginManifest } from '@escalated-dev/plugin-sdk';

export class PluginRuntime {
  private rpc: JsonRpcHandler;
  private dispatcher: Dispatcher;
  private loader: PluginLoader;
  private plugins: ResolvedPlugin[] = [];

  constructor(basePath: string) {
    this.rpc = new JsonRpcHandler(process.stdin, process.stdout);
    this.dispatcher = new Dispatcher();
    this.loader = new PluginLoader(basePath);
  }

  async start(): Promise<void> {
    // Load plugins
    this.plugins = await this.loader.discover();

    // Register each plugin with a context proxy
    for (const plugin of this.plugins) {
      const ctx = createContextProxy(plugin.name, (method, params) => this.rpc.sendRequest(method, params));
      this.dispatcher.register(plugin, ctx);
    }

    // Handle incoming messages from host. A call with an id runs inside
    // hostCall, so the ctx.* requests its handlers make carry that id.
    this.rpc.onMessage(async (msg) => {
      try {
        const result =
          msg.id === undefined || msg.id === null
            ? await this.handleMessage(msg)
            : await hostCall.run(msg.id, () => this.handleMessage(msg));
        if (msg.id !== undefined) {
          this.rpc.sendResponse(msg.id, result);
        }
      } catch (err: any) {
        if (msg.id !== undefined) {
          this.rpc.sendError(msg.id, -32000, err.message ?? 'Unknown error');
        }
      }
    });

    this.rpc.start();

    // Send ready signal via stderr (stdout is for JSON-RPC)
    process.stderr.write('escalated-plugin-runtime: ready\n');
  }

  private async handleMessage(msg: { method: string; params?: any }): Promise<unknown> {
    const { method, params } = msg;
    // The host's active plugins, when it sends them; undefined runs every plugin.
    const active = activePlugins(params);

    switch (method) {
      case 'handshake':
        return {
          protocol_version: '1.0',
          runtime_version: '0.2.0',
          compatible: params?.protocol_version === '1.0',
          http_contract_versions: [1],
          host_call_ids: true,
          active_plugin_lists: true,
        };

      case 'manifest':
        return this.getManifests();

      case 'action':
        await this.dispatcher.dispatchAction(params.hook, params.event, active);
        return { ok: true };

      case 'filter':
        return await this.dispatcher.applyFilter(params.hook, params.value, active);

      case 'endpoint':
        return await this.dispatcher.callEndpoint(
          params.plugin,
          params.method,
          params.path,
          decodeHttpRequest(params),
          active,
        );

      case 'webhook':
        return await this.dispatcher.callWebhook(
          params.plugin,
          params.method,
          params.path,
          decodeHttpRequest(params),
          active,
        );

      case 'activate': {
        const plugin = this.plugins.find((p) => p.name === params.plugin);
        if (plugin?.onActivate) {
          const ctx = createContextProxy(plugin.name, (m, p) => this.rpc.sendRequest(m, p));
          await plugin.onActivate(ctx);
        }
        return { ok: true };
      }

      case 'deactivate': {
        const plugin = this.plugins.find((p) => p.name === params.plugin);
        if (plugin?.onDeactivate) {
          const ctx = createContextProxy(plugin.name, (m, p) => this.rpc.sendRequest(m, p));
          await plugin.onDeactivate(ctx);
        }
        return { ok: true };
      }

      case 'ping':
        return { pong: true, timestamp: Date.now() };

      case 'cron': {
        if (!isActive(params.plugin, active)) return { ok: true };
        const plugin = this.plugins.find((p) => p.name === params.plugin);
        const handler = plugin?.cron?.[params.schedule];
        if (handler) {
          const ctx = createContextProxy(plugin!.name, (m, p) => this.rpc.sendRequest(m, p));
          await handler(ctx);
        }
        return { ok: true };
      }

      case 'badge': {
        if (!isActive(params.plugin, active)) return null;
        const plugin = this.plugins.find((p) => p.name === params.plugin);
        const widget = plugin?.widgets?.find((w) => w.component === params.component);
        if (widget?.badge) {
          const ctx = createContextProxy(plugin!.name, (m, p) => this.rpc.sendRequest(m, p));
          return await widget.badge(ctx);
        }
        return null;
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private getManifests(): Record<string, PluginManifest> {
    const manifests: Record<string, PluginManifest> = {};
    for (const plugin of this.plugins) {
      manifests[plugin.name] = plugin.toManifest();
    }
    return manifests;
  }
}
