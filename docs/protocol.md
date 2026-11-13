# Protocol

## Protocol

Communication uses JSON-RPC 2.0 over stdin/stdout. See the [Plugin SDK docs](https://github.com/escalated-dev/escalated-plugin-sdk) for the full protocol specification.

### Host call ids

The runtime serves host calls concurrently. Every `ctx.*` request a plugin makes
while handling a host call (`action`, `filter`, `endpoint`, `webhook`, `cron`,
`badge`, `activate`, `deactivate`) carries `host_call_id`: the JSON-RPC `id` of
that host call. A host serving several requests at once uses it to find the
request, and so the acting user and the plugin being served, that each `ctx.*`
call belongs to. A call made outside any host call (a timer the plugin started)
has no `host_call_id`. The handshake answers `host_call_ids: true`; hosts that
ignore the field keep working as before.

### Active plugins

The runtime loads every installed plugin, but only the host knows which ones an
admin has activated. A host passes `plugins: [names]` (the manifest names of its
active plugins) on `action`, `filter`, `endpoint`, `webhook`, `cron` and `badge`,
and the runtime then runs only those plugins' handlers: actions and filters skip
the others, an endpoint or webhook of an unlisted plugin is an error, `cron` does
nothing and `badge` answers `null`. An empty list runs nothing. A call with no
`plugins` key runs every loaded plugin, as older runtimes did. The handshake
answers `active_plugin_lists: true`.
