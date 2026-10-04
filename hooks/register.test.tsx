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
