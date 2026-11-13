# Architecture

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

## Broadcasting Event Forwarding

When the host framework has real-time broadcasting enabled, the runtime automatically forwards broadcasting events to plugins. The bridge sends these as standard action hooks (e.g., `broadcast.ticket.updated`, `broadcast.ticket.replied`) so plugins can react to real-time events without any additional configuration. See the [Plugin SDK README](https://github.com/escalated-dev/escalated-plugin-sdk/blob/master/docs/core-api.md#broadcastable-events) for the full list of broadcastable events.
