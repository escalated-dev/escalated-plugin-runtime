# @escalated-dev/plugin-runtime

[![Tests](https://github.com/escalated-dev/escalated-plugin-runtime/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-plugin-runtime/actions/workflows/run-tests.yml)
[![Node.js](https://img.shields.io/badge/node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Runtime host for [Escalated](https://escalated.dev) plugins. Loads plugins built with the [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk) and communicates with the host framework (Laravel, Rails, Django, AdonisJS) via JSON-RPC 2.0 over stdio.

> **[escalated.dev](https://escalated.dev)** — Learn more, view demos, and compare Cloud vs Self-Hosted options.

## Installation

```bash
npm install @escalated-dev/plugin-runtime
```

This package is installed alongside any SDK plugins you want to use. The host framework's bridge spawns it automatically — you do not need to run it manually.

## Usage

The runtime is started by the framework bridge (e.g., `escalated-laravel`, `escalated-rails`, `escalated-django`). You typically do not invoke it directly. The bridge spawns it as:

```bash
node node_modules/@escalated-dev/plugin-runtime/dist/index.js
```

## Architecture

The runtime is a long-lived Node.js process that:

1. Discovers and loads installed plugins from `node_modules/@escalated-dev/plugin-*`
2. Responds to JSON-RPC messages from the host framework
3. Routes hooks (actions, filters) to registered plugin handlers
4. Proxies `ctx.*` calls back to the host for data operations

```
Host Framework (PHP/Ruby/Python)         Plugin Runtime (Node.js)
┌──────────────────────────┐   stdio    ┌──────────────────────────┐
│  Bridge                  │◄──────────►│  @escalated-dev/          │
│  - spawns subprocess     │  JSON-     │    plugin-runtime         │
│  - dispatches hooks      │  RPC 2.0  │  ┌────────────────────┐   │
│  - handles ctx.* calls   │           │  │ plugin-slack        │   │
│                          │           │  │ plugin-jira         │   │
│                          │           │  │ your-custom-plugin  │   │
└──────────────────────────┘           │  └────────────────────┘   │
                                       └──────────────────────────┘
```

### Resilience

- Spawned lazily on first hook dispatch
- Automatic restart with exponential backoff if the process crashes
- Action hooks degrade gracefully when the runtime is unavailable
- Filter hooks return unmodified values when the runtime is down

## Protocol

Communication uses JSON-RPC 2.0 over stdin/stdout. See the [Plugin SDK docs](https://github.com/escalated-dev/escalated-plugin-sdk) for the full protocol specification.

## Related Packages

- **[Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk)** — TypeScript SDK for building plugins
- **[Escalated](https://github.com/escalated-dev/escalated)** — Shared frontend (Vue 3 + Inertia.js)
- **[Escalated Docs](https://github.com/escalated-dev/escalated-docs)** — Full documentation

## License

MIT
