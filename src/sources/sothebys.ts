import type { BrowserContext } from 'playwright-core'
import type { Lot } from '../db.ts'

// Placeholder until the logged-in result format is mapped.
export async function* sothebys(_ctx: BrowserContext, _keywords: string[], _opts: { maxPages?: number } = {}): AsyncGenerator<Lot[]> {
  throw new Error('sothebys: not implemented yet')
}
