#!/usr/bin/env node
import { PluginRuntime } from '../src/runtime.js';

const basePath = process.argv[2] || process.cwd();
const runtime = new PluginRuntime(basePath);

runtime.start().catch((err) => {
    process.stderr.write(`escalated-plugin-runtime: fatal error: ${err.message}\n`);
    process.exit(1);
});
