// CollectorSquare "Lux Price Index": aggregates results from Christie's, Sotheby's, Artcurial, Bonhams, Heritage,
// Gros & Delettrez… Prices and estimates are only shown to logged-in users, so requests go through the browser profile.
import type { APIRequestContext } from 'playwright-core'
import type { Lot } from '../db.ts'
import { num, parseTitle } from '../parse.ts'
import { sleep } from '../util.ts'

const BASE = 'https://www.collectorsquare.com'

// Every Birkin / Kelly model index on the site. Add any /lpi page (other brands too) to scrape it.
export const CS_PAGES = [
  'birkin', 'birkin-25-cm', 'birkin-28-cm', 'birkin-30-cm', 'birkin-32-cm', 'birkin-35-cm', 'birkin-40-cm',
  'birkin-shoulder', 'birkin-so-black', 'birkin-travel-bag',
  'kelly', 'mini-kelly', 'kelly-25-cm', 'kelly-28-cm', 'kelly-29-cm', 'kelly-30-cm', 'kelly-32-cm', 'kelly-33-cm',
  'kelly-35-cm', 'kelly-36-cm', 'kelly-40-cm', 'kelly---backpack', 'kelly-lakis', 'kelly-plastic',
  'kelly---pocket-hand', 'kelly-shoulder', 'kelly-so-black', 'kelly-sport', 'relax-kelly',
].map((slug) => `${BASE}/sacs/hermes/${slug}/lpi`)

const PAGE_SIZE = 40

export async function* collectorsquare(req: APIRequestContext, pages = CS_PAGES, { maxPages = Infinity } = {}) {
  for (const pageUrl of pages) {
    const html = await (await req.get(pageUrl)).text()
    const ajax = html.match(/data-more-results-ajax-url="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
    const total = Number(html.match(/Détails \((\d+) résultats\)/)?.[1] ?? 0)
    if (!ajax) { console.warn(`collectorsquare: no results list on ${pageUrl}`); continue }
    if (!/>Vendu: </.test(html) && /Non vendu/.test(html) && !/Mon compte|Déconnexion/i.test(html))
      console.warn('collectorsquare: looks logged out, prices will be missing. Run `pnpm login`.')
    for (let start = 0, n = 0; start < total && n < maxPages; start += PAGE_SIZE, n++) {
      const body = start === 0 ? html : await (await req.get(BASE + ajax.replace(/startIndex=\d+/, `startIndex=${start}`), {
        headers: { 'x-requested-with': 'XMLHttpRequest' },
      })).text()
      console.log(`collectorsquare ${pageUrl.split('/').at(-2)} ${start}/${total}`)
      yield parseResults(body, pageUrl)
      await sleep(1000)
    }
  }
}

const ENT: Record<string, string> = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>' }
const strip = (s: string) =>
  s.replace(/<[^>]+>/g, ' ')
    .replace(/&#(x?)([0-9a-f]+);/gi, (_, x, n) => String.fromCodePoint(parseInt(n, x ? 16 : 10)))
    .replace(/&(\w+);/g, (m, e) => ENT[e] ?? m)
    .replace(/\s+/g, ' ').trim()

export function parseResults(html: string, pageUrl: string): Lot[] {
  return html.split(/<li class="result-\d+ /).slice(1).map((card) => {
    // "Label :" <span>value</span> pairs
    const field = (label: string) =>
      card.match(new RegExp(`text-gray-400">${label}\\s*:?\\s*</span>([\\s\\S]*?)</div>`))?.[1]
    const f = (label: string) => { const v = field(label); return v ? strip(v) || null : null }
    const values = (chunk?: string) => [...(chunk ?? '').matchAll(/font-medium">([^<]*)</g)].map((m) => m[1].trim())

    const saleLine = strip(card.match(/<span class="font-medium">([^<]*#[^<]*)<\/span>/)?.[1] ?? '') || null
    const maison = saleLine?.split('#')[0].trim().replace(/^Christies$/, "Christie's").replace(/^Sothebys$/, "Sotheby's") || null
    const currencies = values(card.match(/<span>&nbsp;<\/span>\s*<ul>([\s\S]*?)<\/ul>/)?.[1])
    const sold = values(card.match(/text-gray-400">Vendu:\s*<\/span>\s*<ul>([\s\S]*?)<\/ul>/)?.[1])
    const est = card.match(/text-gray-400">Estimation:\s*<\/span>\s*<ul>\s*<li>([\s\S]*?)<\/li>/)?.[1]
    const [lo, hi] = values(est)
    const title = strip(card.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '') || null
    const desc = f('Description')
    const [d, m, y] = (f('Date de vente') ?? '').split('/')
    const lot = f('ID Lot')
    const p = parseTitle(`${title ?? ''} ${desc ?? ''}`)

    return {
      id: `collectorsquare:${saleLine}:${lot}`,
      source: 'collectorsquare.com',
      maison,
      vente: [saleLine, f('Pays')].filter(Boolean).join(' · ') || null,
      date_vente: y ? `${y}-${m}-${d}` : null,
      lot,
      url: pageUrl,
      marque: f('Marque'),
      modele: f('Modèle') ?? p.modele,
      taille: p.taille ?? f('Modèle')?.match(/(\d{2}) cm/)?.[1] ?? null,
      couleur: f('Couleur') ? [f('Couleur'), p.couleur].filter(Boolean).join(' / ') : p.couleur,
      matiere: [f('Matière'), p.matiere].filter(Boolean).join(' / ') || null,
      quincaillerie: p.quincaillerie,
      annee: p.annee ?? (num(f('Période')) || null),
      etat: f('Condition') ?? p.etat,
      vendu: sold.length ? 1 : /Non vendu/.test(card) ? 0 : null,
      estimation_basse: num(lo),
      estimation_haute: num(hi),
      prix: num(sold[0]),
      devise: currencies[0]?.replace(/^HKDG$/, 'HKD') ?? null,
      prix_frais_inclus: null,
      titre: title,
      remarques: [sold[1] && currencies[1] === 'EUR' && `prix EUR: ${sold[1]}`, desc].filter(Boolean).join(' | ') || null,
    } satisfies Lot
  })
}

if (import.meta.main) {
  const { readFileSync } = await import('node:fs')
  const lots = parseResults(readFileSync(process.argv[2], 'utf8'), 'test')
  console.log(lots.length, lots.filter((l) => l.vendu).slice(0, 2), lots[0])
}
