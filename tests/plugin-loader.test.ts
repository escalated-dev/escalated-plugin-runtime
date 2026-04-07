import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PluginLoader } from '../src/plugin-loader.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('PluginLoader', () => {
  const testDir = join(tmpdir(), 'escalated-test-plugins-' + Date.now());

  it('discovers plugins in a directory', async () => {
    // Create a mock plugin
    const pluginDir = join(testDir, 'node_modules', '@escalated-dev', 'plugin-test');
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, 'package.json'),
      JSON.stringify({
        name: '@escalated-dev/plugin-test',
        main: 'src/index.js',
      }),
    );
    mkdirSync(join(pluginDir, 'src'), { recursive: true });
    writeFileSync(
      join(pluginDir, 'src', 'index.js'),
      `
            export default {
                name: 'test',
                version: '1.0.0',
                __escalated: true,
                _normalizedFilters: {},
                _normalizedEndpoints: {},
                toManifest() { return { name: 'test', version: '1.0.0', config: [], pages: [], components: [], widgets: [], actionHooks: [], filterHooks: [], endpoints: [], webhooks: [], cronSchedules: [] }; },
            };
        `,
    );

    const loader = new PluginLoader(testDir);
    const plugins = await loader.discover();

    assert.ok(plugins.length >= 1);
    assert.strictEqual(plugins[0]!.name, 'test');

    rmSync(testDir, { recursive: true, force: true });
  });
});
