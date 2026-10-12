# Changelog

## 0.4.1

- A failed request no longer restarts the countdown; it goes back to what it
  was before the request (or shows cold if there was no earlier entry).
- More tests: subagent requests, requests that don't touch the cache, cache
  reads and failed requests.
- CI runs `claude plugin validate .` and `claude plugin test .` on every pull
  request.

## 0.4.0

First version recorded in this changelog.
