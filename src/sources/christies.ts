// Christie's: the public search API behind christies.com/en/search returns sold lots with estimate + price realised
// (buyer's premium included). No login needed.
import type { Lot } from '../db.ts'
import { money, parseTitle } from '../parse.ts'
import { sleep, UA } from '../util.ts'

const API = 'https://apim.christies.com/search-client'

async function datasourceId(keyword: string) {
  const html = await fetch(`https://www.christies.com/en/search?entry=${encodeURIComponent(keyword)}&tab=sold_lots`, {
    headers: { 'user-agent': UA },
  }).then((r) => r.text())
  const id = html.match(/"datasource_id":"([0-9a-f-]{36})"/)?.[1]
  if (!id) throw new Error("christies: datasource_id not found on search page, the site changed")
  return id
}

export async function* christies(keywords: string[], { maxPages = Infinity } = {}) {
  for (const keyword of keywords) {
    const ds = await datasourceId(keyword)
    for (let page = 1, total = 1; page <= Math.min(total, maxPages); page++) {
      const qs = new URLSearchParams({
        keyword, page: String(page), is_past_lots: 'True', sortby: 'date', language: 'en',
        geocountrycode: 'FR', show_on_loan: 'true', datasourceId: ds,
      })
      const res = await fetch(`${API}?${qs}`, {
        headers: {
          'user-agent': UA, accept: 'application/vnd.christies.v1+json', 'source-application': 'gsrp',
          origin: 'https://www.christies.com', referer: 'https://www.christies.com/',
        },
      })
      if (!res.ok) throw new Error(`christies ${keyword} p${page}: HTTP ${res.status}`)
      const j: any = await res.json()
      total = j.total_pages ?? 0
      console.log(`christies "${keyword}" page ${page}/${total}`)
      yield (j.lots ?? []).map(toLot) as Lot[]
      await sleep(800)
    }
  }
}

function toLot(l: any): Lot {
  const title = [l.title_primary_txt, l.title_secondary_txt, l.title_tertiary_txt].filter(Boolean).join(' — ')
  const p = parseTitle(`${title} ${l.description_txt ?? ''}`)
  const est = money(l.estimate_txt)
  const real = money(l.price_realised_txt)
  return {
    id: `christies:${l.object_id}`,
    source: 'christies.com',
    maison: "Christie's",
    vente: [l.sale?.number && `#${l.sale.number}`, l.sale?.location, l.sale?.type].filter(Boolean).join(' · ') || null,
    date_vente: (l.end_date || l.start_date)?.slice(0, 10) ?? null,
    lot: l.lot_id_txt ?? null,
    url: l.url ?? null,
    marque: /herm[eè]s/i.test(title) ? 'Hermès' : (l.title_secondary_txt?.split(',')[0]?.trim() || null),
    ...p,
    vendu: l.lot_withdrawn ? 0 : real.a ? 1 : l.is_auction_over ? 0 : null,
    estimation_basse: est.a,
    estimation_haute: est.b,
    prix: null,
    devise: real.devise ?? est.devise,
    prix_frais_inclus: real.a,
    titre: title,
    remarques: [l.lot_withdrawn && 'retiré', l.estimate_on_request && 'estimation sur demande', l.price_on_request && 'prix sur demande']
      .filter(Boolean).join(', ') || null,
  }
}
