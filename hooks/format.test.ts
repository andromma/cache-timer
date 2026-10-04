import { expect, test } from 'claude-code/testing'

import { TTL_MS, formatView, shortTokens } from './format'

const HOUR = TTL_MS['1h']

test('shows whole minutes, rounded down, while ok', () => {
  expect(formatView(52 * 60_000 + 50_000, HOUR, 'claude-opus-5-5')).toEqual({
    text: 'cache 52m · opus',
    level: 'ok',
  })
  expect(formatView(10 * 60_000 + 1000, HOUR, 'claude-opus-5-5').text).toBe('cache 10m · opus')
})

test('switches to mm:ss once it warns', () => {
  expect(formatView(10 * 60_000, HOUR, 'claude-opus-5-5')).toEqual({
    text: 'cache 10:00 · opus',
    level: 'warn',
  })
})

test('warns at 10 minutes and runs low at 2 minutes', () => {
  expect(formatView(10 * 60_000, HOUR, 'claude-sonnet-5-5').level).toBe('warn')
  expect(formatView(90_000, HOUR, 'claude-sonnet-5-5')).toEqual({
    text: 'cache 01:30 · sonnet',
    level: 'low',
  })
})

test('goes cold once the TTL has passed', () => {
  expect(formatView(0, HOUR, 'claude-opus-5-5')).toEqual({
    text: 'cache cold · opus',
    level: 'cold',
  })
  expect(formatView(-5000, HOUR, 'claude-opus-5-5').level).toBe('cold')
})

test('scales the thresholds down for a 5 minute TTL', () => {
  expect(formatView(3 * 60_000, TTL_MS['5m'], 'claude-haiku-4-5')).toEqual({
    text: 'cache 3m · haiku',
    level: 'ok',
  })
  expect(formatView(90_000, TTL_MS['5m'], 'claude-haiku-4-5').level).toBe('warn')
  expect(formatView(50_000, TTL_MS['5m'], 'claude-haiku-4-5').level).toBe('low')
})

test('appends the cached prefix size when known', () => {
  expect(formatView(30 * 60_000, HOUR, 'claude-opus-5-5', 182_400).text).toBe(
    'cache 30m · opus · 182k',
  )
  expect(formatView(0, HOUR, 'claude-opus-5-5', 182_400).text).toBe('cache cold · opus · 182k')
  expect(formatView(30 * 60_000, HOUR, 'claude-opus-5-5').text).toBe('cache 30m · opus')
})

test('shortens token counts', () => {
  expect(shortTokens(850)).toBe('850')
  expect(shortTokens(1000)).toBe('1k')
  expect(shortTokens(182_400)).toBe('182k')
  expect(shortTokens(999_700)).toBe('1M')
  expect(shortTokens(1_250_000)).toBe('1.3M')
})
