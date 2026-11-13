<p align="center">
  <a href="https://escalated.dev"><img src="https://raw.githubusercontent.com/escalated-dev/escalated/main/docs/assets/readme/logo.png" width="72" height="72" alt="Escalated"></a>
</p>

<h1 align="center">Escalated Plugin Runtime</h1>

<p align="center">
  The Node.js process that runs Escalated plugins.<br>
  Your backend's bridge starts it and talks to it over JSON-RPC 2.0 on stdio.
</p>

<p align="center">
  <a href="https://escalated.dev"><b>Website</b></a> ·
  <a href="https://escalated.dev/docs"><b>Docs</b></a> ·
  <a href="https://escalated.dev/cloud"><b>Cloud</b></a> ·
  <a href="https://github.com/escalated-dev/escalated-plugin-runtime/releases"><b>Releases</b></a>
</p>

<br>

A plugin written with the [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk) is all the runtime needs:

```ts
import { definePlugin } from '@escalated-dev/plugin-sdk'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',

  actions: {
    'ticket.created': async (event, ctx) => {
      ctx.log.info('New ticket!', event)
    },
  },
})
```

## What it does

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>Runs every installed plugin in one process</h3>
      It finds plugins in <code>node_modules/@escalated-dev/plugin-*</code>, routes hooks to them, and proxies their <code>ctx.*</code> calls back to your backend.
    </td>
    <td width="50%" valign="top">
      <h3>Never takes the helpdesk down with it</h3>
      Your backend's bridge starts it on the first hook and restarts it with backoff after a crash. While it is down, filters return values unchanged.
    </td>
  </tr>
</table>

## Features

<table>
<tr>
<td width="33%" valign="top">

**Loading**
- Discovers `@escalated-dev/plugin-*` packages
- Started by your backend's bridge
- Spawned lazily on first hook

</td>
<td width="33%" valign="top">

**Dispatch**
- Actions, filters, endpoints, webhooks
- Cron jobs and widget badges
- Activate and deactivate calls

</td>
<td width="33%" valign="top">

**Resilience (via the bridge)**
- Restarts with exponential backoff
- Actions degrade when it is unavailable
- Filters pass values through when down

</td>
</tr>
<tr>
<td width="33%" valign="top">

**Protocol**
- JSON-RPC 2.0 over stdin and stdout
- Concurrent host calls
- `host_call_id` on every `ctx.*` call

</td>
<td width="33%" valign="top">

**Active plugins**
- Runs only plugins the host lists
- Older hosts run every loaded plugin

</td>
<td width="33%" valign="top">

**Real-time**
- Forwards broadcast events as action hooks
- No extra plugin configuration

</td>
</tr>
</table>

<p align="center"><sub><a href="docs/architecture.md">Every feature in detail</a></sub></p>

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://www.jsonrpc.org/specification"><img src="https://img.shields.io/badge/JSON--RPC_2.0-555555?style=for-the-badge" alt="JSON-RPC 2.0"></a>
</p>

## Quick start

```bash
npm install @escalated-dev/plugin-runtime
```

Install it next to the plugins you want to use. Your backend's bridge spawns it, so you don't run it yourself. See [installation and usage](docs/installation.md).

## Learn more

- [Installation and usage](docs/installation.md) · [Architecture and broadcasting](docs/architecture.md) · [Protocol](docs/protocol.md)
- [Releasing this package](RELEASE.md)
- [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk) for writing plugins
- [Escalated docs](https://escalated.dev/docs) · [Docs source](https://github.com/escalated-dev/escalated-docs) · [Shared frontend](https://github.com/escalated-dev/escalated)

## License

MIT. Copyright (c) Escalated.dev. See [LICENSE](LICENSE).
