import { DatabaseSync } from 'node:sqlite'

export type Lot = {
  id: string // `${source}:${stable id on that source}`
  source: string // site the row was scraped from
  maison: string | null // auction house
  vente: string | null // sale title / number
  date_vente: string | null // YYYY-MM-DD
  lot: string | null
  url: string | null
  marque: string | null
  modele: string | null
  taille: string | null
  couleur: string | null
  matiere: string | null
  quincaillerie: string | null
  annee: number | null
  etat: string | null
  vendu: 0 | 1 | null
  estimation_basse: number | null
  estimation_haute: number | null
  prix: number | null // hammer price when the source gives it
  devise: string | null
  prix_frais_inclus: number | null
  titre: string | null
  remarques: string | null
}

export const COLUMNS = [
  'id', 'source', 'maison', 'vente', 'date_vente', 'lot', 'url', 'marque', 'modele', 'taille',
  'couleur', 'matiere', 'quincaillerie', 'annee', 'etat', 'vendu', 'estimation_basse',
  'estimation_haute', 'prix', 'devise', 'prix_frais_inclus', 'titre', 'remarques',
] as const satisfies readonly (keyof Lot)[]

export function openDb(path = 'data/lots.sqlite') {
  const db = new DatabaseSync(path)
  db.exec(`CREATE TABLE IF NOT EXISTS lots (
    ${COLUMNS.map((c) => (c === 'id' ? 'id TEXT PRIMARY KEY' : `${c}`)).join(',\n    ')},
    scraped_at TEXT DEFAULT (datetime('now'))
  )`)
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO lots (${COLUMNS.join(',')}) VALUES (${COLUMNS.map((c) => ':' + c).join(',')})`,
  )
  return {
    db,
    save(lots: Lot[]) {
      db.exec('BEGIN')
      for (const l of lots) upsert.run(l as any)
      db.exec('COMMIT')
    },
    has: (id: string) => !!db.prepare('SELECT 1 FROM lots WHERE id = ?').get(id),
  }
}
