// tokens: the cached prefix the last request read or wrote; absent before the
// first response (and in values older versions kept).
export type CacheHit = { at: number; model: string; tokens?: number }

export type CacheLevel = 'ok' | 'warn' | 'low' | 'cold'

export type CacheView = { text: string; level: CacheLevel }

declare module 'claude-code' {
  interface PluginState {
    'cache-timer': { lastHit: CacheHit; view: CacheView | null }
  }
}
