import { atom, read } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { CacheHit, CacheLevel } from '../types'
import { formatView, ttlFromOption } from './format'

const LAST_HIT = { plugin: 'cache-timer', key: 'lastHit' } as const
const VIEW = { plugin: 'cache-timer', key: 'view' } as const
const view = atom(VIEW, null)

const COLOR: Record<CacheLevel, string> = {
  ok: 'success',
  warn: 'warning',
  low: 'error',
  cold: 'inactive',
}

// Ticks only while there is a countdown to show; a reload drops it with the
// old environment.
let ticker: Timer | undefined

function startTicking($: EngineInterface, ttlMs: number) {
  ticker ??= $.clock.every(1000, () => paint($, ttlMs))
}

function stopTicking() {
  ticker?.cancel()
  ticker = undefined
}

async function paint($: EngineInterface, ttlMs: number) {
  const { value: hit } = await $.state.get(LAST_HIT)
  if (!hit) return stopTicking()

  const next = formatView(hit.at + ttlMs - (await $.clock.now()), ttlMs, hit.model, hit.tokens)
  // Cold stays cold until the next request, which starts the ticker again.
  if (next.level === 'cold') stopTicking()

  const { value: shown } = await $.state.get(VIEW)
  if (shown?.text === next.text && shown.level === next.level) return

  // Readers of the view redraw on this write.
  await $.state.set(VIEW, next)
}

export const register: Register = (on, options) => {
  const ttlMs = ttlFromOption(options.ttl)

  on('session.start', async ($, e, next) => {
    // Clear the plain status line earlier versions pinned.
    $.ui.status(undefined)
    startTicking($, ttlMs)
    await paint($, ttlMs)

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    // Subagents cache their own prefix; only the main thread's matters here.
    if (e.agentId !== undefined) return yield* next(e)

    // The TTL runs from the start of the request that reads or writes the
    // entry, so restart the countdown as the request goes out.
    const { value: before } = await $.state.get(LAST_HIT)
    // Until the response says otherwise, the prefix is the size it was.
    const sent: CacheHit = {
      at: await $.clock.now(),
      model: e.model,
      ...(before?.tokens !== undefined && { tokens: before.tokens }),
    }
    await $.state.set(LAST_HIT, sent)
    startTicking($, ttlMs)
    await paint($, ttlMs)

    let result
    try {
      result = yield* next(e)
    } catch (error) {
      // A failed request may not have touched the cache, so don't claim the
      // countdown restarted; the previous entry's clock still stands.
      // With no earlier entry there is nothing to restore, so show it as cold.
      await $.state.set(LAST_HIT, before ?? { ...sent, at: sent.at - ttlMs })
      await paint($, ttlMs)
      throw error
    }
    const usage = result.usage
    const cached = usage === null ? 0 : usage.cache_read_input_tokens + usage.cache_creation_input_tokens

    if (usage !== null && cached > 0) {
      await $.state.set(LAST_HIT, { ...sent, model: usage.model, tokens: cached })
    } else if (before) {
      // Nothing was read or written: the previous entry's clock still stands.
      await $.state.set(LAST_HIT, before)
    }
    await paint($, ttlMs)

    return result
  })

  // Drawn at the end of the hint line under the prompt, in the level's color.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const shown = await read($, view)
    if (!shown) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        {await next(e)}
        <Text color={COLOR[shown.level]}>  {shown.text}</Text>
      </Box>
    )
  })
}
