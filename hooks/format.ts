import type { CacheLevel, CacheView } from '../types'

const MINUTE = 60_000

export const TTL_MS = { '1h': 60 * MINUTE, '5m': 5 * MINUTE } as const

export const ttlFromOption = (option: unknown): number =>
  option === '5m' ? TTL_MS['5m'] : TTL_MS['1h']

// "claude-opus-5-5" -> "opus"
export const shortModel = (model: string): string =>
  model.match(/(opus|sonnet|haiku|fable)/)?.[1] ?? model

// 850 -> "850", 182_400 -> "182k", 1_250_000 -> "1.3M"
export const shortTokens = (tokens: number): string =>
  tokens < 1000
    ? String(tokens)
    : tokens < 999_500
      ? `${Math.round(tokens / 1000)}k`
      : `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`

export const formatView = (
  remainingMs: number,
  ttlMs: number,
  model: string,
  tokens = 0,
): CacheView => {
  const tail = ` · ${shortModel(model)}${tokens > 0 ? ` · ${shortTokens(tokens)}` : ''}`

  if (remainingMs <= 0) return { text: `cache cold${tail}`, level: 'cold' }

  const level: CacheLevel =
    remainingMs <= Math.min(2 * MINUTE, ttlMs * 0.2)
      ? 'low'
      : remainingMs <= Math.min(10 * MINUTE, ttlMs * 0.4)
        ? 'warn'
        : 'ok'

  // Whole minutes while there is plenty left (rounded down, never overstating),
  // seconds once it matters.
  if (level === 'ok') {
    return { text: `cache ${Math.floor(remainingMs / MINUTE)}m${tail}`, level }
  }

  const total = Math.ceil(remainingMs / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')

  return { text: `cache ${mm}:${ss}${tail}`, level }
}
