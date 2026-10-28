import ExcelJS from 'exceljs'
import { COLUMNS } from './db.ts'
import type { DatabaseSync } from 'node:sqlite'

const HEADERS: Record<string, string> = {
  id: 'ID', source: 'Site', maison: 'Maison de vente', vente: 'Vente', date_vente: 'Date de vente', lot: 'N° de lot',
  url: 'Lien URL', marque: 'Marque', modele: 'Modèle', taille: 'Taille', couleur: 'Couleur', matiere: 'Matière',
  quincaillerie: 'Quincaillerie', annee: 'Année de fabrication', etat: 'État', vendu: 'Vendu',
  estimation_basse: 'Estimation basse', estimation_haute: 'Estimation haute', prix: 'Prix (marteau)',
  devise: 'Devise', prix_frais_inclus: 'Prix frais inclus', titre: 'Titre du lot', remarques: 'Remarques / Autres',
}

export async function exportXlsx(db: DatabaseSync, path = 'data/lots.xlsx') {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Lots', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLUMNS.filter((c) => c !== 'id').map((c) => ({
    header: HEADERS[c], key: c,
    width: c === 'titre' || c === 'remarques' ? 60 : c === 'url' || c === 'vente' ? 40 : 16,
  }))
  const rows = db.prepare('SELECT * FROM lots ORDER BY date_vente DESC').all() as any[]
  for (const r of rows) ws.addRow({ ...r, vendu: r.vendu == null ? '' : r.vendu ? 'Oui' : 'Non', url: r.url ? { text: r.url, hyperlink: r.url } : '' })
  ws.getRow(1).font = { bold: true }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }
  await wb.xlsx.writeFile(path)
  return rows.length
}
