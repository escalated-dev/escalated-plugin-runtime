# @escalated-dev/plugin-runtime

[![Tests](https://github.com/escalated-dev/escalated-plugin-runtime/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-plugin-runtime/actions/workflows/run-tests.yml)
[![Node.js](https://img.shields.io/badge/node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Runtime host for Escalated plugins. Loads plugins, communicates with the host framework via JSON-RPC 2.0 over stdio.

## Usage

This package is used internally by Escalated framework bridges. You don't typically use it directly.

```bash
# The bridge spawns this automatically:
npx escalated-plugins /path/to/project
```

## Architecture

The runtime is a long-lived Node.js process that:
1. Discovers and loads installed plugins from `node_modules/@escalated-dev/plugin-*`
2. Responds to JSON-RPC messages from the host framework
3. Routes hooks (actions, filters) to registered plugin handlers
4. Proxies `ctx.*` calls back to the host for data operations

## Protocol

Communication uses JSON-RPC 2.0 over stdin/stdout. See the [Plugin SDK docs](https://github.com/escalated-dev/escalated-plugin-sdk) for the full protocol specification.
