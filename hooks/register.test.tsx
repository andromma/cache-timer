import { expect, mock, test } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const

const HINT = {
  plugin: 'cache-timer',
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

for (const surface of SURFACES) {
  test(`draws a colored countdown on the hint line (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('ui.status', () => ({ value: undefined }))
    on('turn.step', async function* (_$, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: 'hi',
        toolUses: [],
        stopReason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 1000,
          cache_creation_input_tokens: 0,
          model: 'claude-opus-5-5',
        },
      }
    })
    on('ui.render', { component: 'PromptHint' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>{e.props.hint}</Text>
    })

    await $.session.start({ cwd: '/tmp', surface, isInteractive: true })
    const step = async (turnId: string) => {
      for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
        // drain the stream
      }
    }
    await step('t1')

    const ui = await $.ui.mount({ ...HINT, surface })
    const fresh = await ui.find({ type: 'Text', text: /cache 60m · opus · 1k/ })
    expect(fresh?.props.color).toBe('success')

    await clock.advance(55 * 60_000)
    const late = await ui.find({ type: 'Text', text: /cache 05:00 · opus/ })
    expect(late?.props.color).toBe('warning')

    await clock.advance(5 * 60_000)
    expect((await ui.find({ type: 'Text', text: /cache cold/ }))?.props.color).toBe('inactive')

    // The ticker stopped at cold; the next request starts it again.
    await clock.advance(30 * 60_000)
    await step('t2')
    expect((await ui.find({ type: 'Text', text: /cache 60m · opus/ }))?.props.color).toBe('success')
    await clock.advance(51 * 60_000)
    expect(await ui.find({ type: 'Text', text: /cache 09:00 · opus/ })).toBeDefined()
  })
}

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  model: string
}

const usage = (cached: number): Usage => ({
  input_tokens: 10,
  output_tokens: 5,
  cache_read_input_tokens: cached,
  cache_creation_input_tokens: 0,
  model: 'claude-opus-5-5',
})

// Mounts the hint with a stubbed model whose responses report `cached` tokens;
// `cached` can be changed between steps.
async function setup($: any, on: any, cached: { value: number }) {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }))
  on('turn.step', async function* (_$: any, e: any) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'hi',
      toolUses: [],
      stopReason: 'end_turn',
      usage: usage(cached.value),
    }
  })
  on('ui.render', { component: 'PromptHint' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{e.props.hint}</Text>
  })

  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const step = async (turnId: string, extra: { agentId?: string } = {}) => {
    for await (const _ of $.turn.step({
      turnId,
      index: 0,
      model: 'claude-opus-5-5',
      messageCount: 1,
      ...extra,
    })) {
      // drain the stream
    }
  }
  const ui = await $.ui.mount({ ...HINT, surface: 'terminal' })

  return { clock, step, ui }
}

test('shows nothing before the first request', async ($, on) => {
  const { ui } = await setup($, on, { value: 1000 })

  expect(await ui.find({ type: 'Text', text: /cache/ })).toBeUndefined()
})

test('ignores subagent requests', async ($, on) => {
  const { step, ui } = await setup($, on, { value: 1000 })

  await step('sub', { agentId: 'agent-1' })
  expect(await ui.find({ type: 'Text', text: /cache/ })).toBeUndefined()
})

test('a request that neither reads nor writes the cache keeps the countdown', async ($, on) => {
  const cached = { value: 1000 }
  const { clock, step, ui } = await setup($, on, cached)

  await step('t1')
  await clock.advance(30 * 60_000)

  cached.value = 0
  await step('t2')

  // Still counting from t1, and the known prefix size is kept.
  const shown = await ui.find({ type: 'Text', text: /cache 30m · opus · 1k/ })
  expect(shown?.props.color).toBe('success')
  await clock.advance(30 * 60_000)
  expect((await ui.find({ type: 'Text', text: /cache cold · opus · 1k/ }))?.props.color).toBe('inactive')
})

test('a request that reads the cache restarts the countdown and updates the size', async ($, on) => {
  const cached = { value: 1000 }
  const { clock, step, ui } = await setup($, on, cached)

  await step('t1')
  await clock.advance(30 * 60_000)

  cached.value = 182_400
  await step('t2')

  expect(await ui.find({ type: 'Text', text: /cache 60m · opus · 182k/ })).toBeDefined()
})
