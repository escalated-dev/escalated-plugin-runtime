import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ResolvedPlugin } from '@escalated-dev/plugin-sdk';

export class PluginLoader {
  constructor(private basePath: string) {}

  async discover(): Promise<ResolvedPlugin[]> {
    const plugins: ResolvedPlugin[] = [];

    // Scan node_modules/@escalated-dev/plugin-*
    const scopeDir = join(this.basePath, 'node_modules', '@escalated-dev');
    if (existsSync(scopeDir)) {
      const entries = readdirSync(scopeDir, { withFileTypes: true });
      const exclude = new Set(['plugin-sdk', 'plugin-runtime', 'plugin-bridge']);
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('plugin-') && !exclude.has(entry.name)) {
          try {
            const plugin = await this.loadPlugin(join(scopeDir, entry.name));
            if (plugin) plugins.push(plugin);
          } catch (err) {
            console.error(`Failed to load plugin ${entry.name}:`, err);
          }
        }
      }
    }

    // Also scan a local plugins/ directory if it exists
    const localDir = join(this.basePath, 'plugins');
    if (existsSync(localDir)) {
      const entries = readdirSync(localDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const plugin = await this.loadPlugin(join(localDir, entry.name));
            if (plugin) plugins.push(plugin);
          } catch (err) {
            console.error(`Failed to load plugin ${entry.name}:`, err);
          }
        }
      }
    }

    return plugins;
  }

  private async loadPlugin(pluginPath: string): Promise<ResolvedPlugin | null> {
    const pkgPath = join(pluginPath, 'package.json');
    if (!existsSync(pkgPath)) return null;

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const mainFile = pkg.main || 'src/index.js';
    const entryPath = join(pluginPath, mainFile);

    if (!existsSync(entryPath)) return null;

    const moduleUrl = pathToFileURL(entryPath).href;
    const mod = await import(moduleUrl);
    const plugin = mod.default ?? mod;

    if (!plugin || !plugin.__escalated) return null;

    return plugin as ResolvedPlugin;
  }
}
