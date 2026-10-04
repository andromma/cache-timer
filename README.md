# cache-timer

A Claude Code mod that shows how long the prompt cache has left, at the end of
the hint line under the prompt, kept current between turns too.

```
cache 52m · opus · 182k       green   more than 10 minutes left (whole minutes)
cache 09:41 · opus · 182k     yellow  10 minutes or less
cache 01:30 · opus · 182k     red     2 minutes or less
cache cold · opus · 182k      gray    expired
```

The last figure is the size of the cached prefix: what the next request would
have to write again once the cache is cold.

## Install

```sh
claude plugin marketplace add andromma/cache-timer
claude plugin install cache-timer@cache-timer
```

Update with `claude plugin update cache-timer@cache-timer`, then `/reload-plugins`
in a running session.

## How it works

- The countdown restarts when a main-thread request is sent, since the cache TTL
  is measured from the start of the request that reads or writes the entry. One
  prompt can send several requests (one after each tool call), and each of them
  restarts it.
- Requests that neither read nor write the cache leave the countdown as it was.
  Subagent requests are ignored, as they cache their own prefix.
- The timer stops once the cache goes cold and starts again with the next
  request, so nothing runs while the session sits idle.
- The mod makes no model calls and adds nothing to what is sent to the model.
- The figure is an estimate from the last cache access, not a value read back
  from the API.

## Settings

Choose the TTL in `/config`: `1h` (default) or `5m`. For `5m` the thresholds
scale down: minutes above 2 minutes left, red at 1 minute.

## Development

```sh
claude plugin validate .
claude plugin test .
```

Add this folder as a local marketplace and the installed plugin is read from it
directly rather than from a copy, so an edit takes effect after `/reload-plugins`:

```sh
claude plugin marketplace add ~/dev/cache-timer
```

## License

[MIT](LICENSE)
