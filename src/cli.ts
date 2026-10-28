// pnpm login | pnpm scrape [christies|collectorsquare|sothebys ...] [--max-pages N] | pnpm export
import { mkdirSync } from 'node:fs'
import { openDb, type Lot } from './db.ts'
import { exportXlsx } from './export.ts'
import { LOGIN_PAGES, openBrowser } from './browser.ts'
import { christies } from './sources/christies.ts'
import { collectorsquare } from './sources/collectorsquare.ts'
import { sothebys } from './sources/sothebys.ts'

const KEYWORDS = ['birkin', 'kelly']

mkdirSync('data', { recursive: true })
const [cmd = 'scrape', ...rest] = process.argv.slice(2)
const flag = rest.indexOf('--max-pages')
const maxPages = flag >= 0 ? Number(rest.splice(flag, 2)[1]) : Infinity
const { db, save } = openDb()

async function drain(name: string, it: AsyncIterable<Lot[]>) {
  let n = 0
  try {
    for await (const lots of it) { save(lots); n += lots.length }
  } catch (e) {
    console.error(`${name} stopped: ${(e as Error).message} (rows saved so far are kept)`)
  }
  console.log(`${name}: ${n} lots`)
}

if (cmd === 'login') {
  const ctx = await openBrowser(false)
  for (const url of LOGIN_PAGES) await (await ctx.newPage()).goto(url)
  console.log('Log in on each tab, then close the browser window.')
  await new Promise((r) => ctx.on('close', r))
} else if (cmd === 'scrape') {
  const sources = rest.length ? rest : ['christies', 'collectorsquare', 'sothebys']
  if (sources.includes('christies')) await drain('christies', christies(KEYWORDS, { maxPages }))
  if (sources.some((s) => s !== 'christies')) {
    const ctx = await openBrowser()
    if (sources.includes('collectorsquare')) await drain('collectorsquare', collectorsquare(ctx.request, undefined, { maxPages }))
    if (sources.includes('sothebys')) await drain('sothebys', sothebys(ctx, KEYWORDS, { maxPages }))
    await ctx.close()
  }
  console.log(`data/lots.xlsx: ${await exportXlsx(db)} rows`)
} else if (cmd === 'export') {
  console.log(`data/lots.xlsx: ${await exportXlsx(db)} rows`)
} else {
  console.error('usage: node src/cli.ts login | scrape [source...] [--max-pages N] | export')
  process.exit(1)
}
