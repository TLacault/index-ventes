// Best-effort extraction of bag attributes from free-text lot titles (EN + FR).
// ponytail: keyword lists + regexes, not NLP. Unknown leathers/colours land in `titre` only; extend the lists when you spot misses.

const MODELS = ['birkin', 'kelly', 'constance', 'evelyne', 'picotin', 'lindy', 'bolide', 'herbag', 'garden party', 'jypsiere', 'roulis', 'halzan', 'verrou', '2.55', 'classic flap', 'boy', 'speedy', 'neverfull', 'lady dior', 'saddle']
const VARIANTS = ['sellier', 'retourne', 'retourné', 'shoulder', 'mini', 'micro', 'pochette', 'cut', 'danse', 'to go', 'elan', 'faubourg', 'cargo', 'shadow', 'ghillies', 'officier', 'touch', 'haut a courroies', 'hac', 'in-and-out', 'cadena', 'lakis', 'relax', 'flat', 'twilly', 'so black', 'sport', 'backpack', 'pocket']
const LEATHERS = ['togo', 'epsom', 'clemence', 'clémence', 'swift', 'box calf', 'box', 'calf', 'calfskin', 'chevre', 'chèvre', 'mysore', 'barenia', 'barénia', 'evercolor', 'evergrain', 'tadelakt', 'novillo', 'fjord', 'courchevel', 'ardennes', 'vache liegee', 'vache hunter', 'veau', 'taurillon', 'gulliver', 'doblis', 'sombrero', 'butler', 'negonda', 'clemence', 'tc', 'porosus', 'niloticus', 'nilo', 'crocodile', 'alligator', 'mississippiensis', 'lizard', 'lézard', 'ostrich', 'autruche', 'himalaya', 'toile', 'canvas', 'felt', 'feutre', 'wicker', 'osier', 'denim', 'suede', 'velours', 'python', 'caviar', 'lambskin', 'agneau', 'leather', 'cuir']
const STOP = new Set(['a', 'an', 'the', 'hermes', 'hermès', 'matte', 'shiny', 'mat', 'brillant', 'limited', 'edition', 'special', 'order', 'rare', 'important', 'exceptional', 'private', 'collection', 'sac', 'à', 'main', 'en', 'and', 'et', '&', 'of', 'de', 'hss', 'horseshoe', 'stamp', 'vintage', 'new', 'unworn', 'bag', 'set', 'tri-color', 'bi-color', 'tricolor', 'bicolor', 'one-of-a-kind', 'collection:'])

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const wordRe = (w: string) => new RegExp(`(?<![\\p{L}\\d])${norm(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\d])`, 'u')

export function parseTitle(raw: string) {
  // drop accessory lists ("includes … dustbag and box") so "box"/"felt" aren't read as leathers
  const t = norm(raw.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ')).replace(/\b(includes?|comes with|accompanied by|livr[ée]e? avec|vendu avec)\b.*?(?=grade|condition|$)/g, ' ')
  const model = MODELS.find((m) => wordRe(m).test(t)) ?? null
  const variant = VARIANTS.filter((v) => wordRe(v).test(t))
  const size = model && t.match(new RegExp(`${norm(model)}[^\\d]{0,25}?(\\d{2})\\s*(?:cm)?`))?.[1]
  const hardware =
    t.match(/((?:brushed |rose |18k |white |yellow |solid |plated |permabrass |guilloche |diamond )*(?:gold|palladium|silver|ruthenium|permabrass|brass|gold-tone|silver-tone|chevre|plated|diamonds?)[\w -]{0,20}?)\s*hardware/)?.[1] ??
    t.match(/(?:quincaillerie|garnitures?|fermoir|attributs?) (?:en )?(metal )?([a-z]+(?: [a-z]+)?)/)?.slice(1).filter(Boolean).join(' ') ??
    null
  const materials = [...new Set(LEATHERS.filter((l) => wordRe(l).test(t)).map(norm))]
  const years = [...t.matchAll(/(?<!\d)(19[4-9]\d|20[0-3]\d)(?!\d)/g)].map((m) => +m[1])
  const grade = t.match(/(?:condition report )?grade:?\s*([\w+.-]+)/)?.[1]

  // colour = words before the first material/model token, minus fluff (EN titles: "Black Togo Birkin 35 …").
  const firstHit = Math.min(
    ...[...materials, model ?? ''].filter(Boolean).map((w) => t.search(wordRe(w))).filter((i) => i >= 0),
    t.length,
  )
  let colour = t.slice(0, firstHit).split(/[\s,:]+/).filter((w) => w && !STOP.has(w) && !/^\d/.test(w)).join(' ')
  // FR titles put the colour after the material: "… en cuir togo ébène"
  if (!colour) colour = t.match(/en (?:cuir|toile|crocodile|alligator|autruche|lezard|python)(?: [a-z]+)? ([a-z]+(?: [a-z]+)?)$/)?.[1] ?? ''

  return {
    modele: model && [model, ...variant].join(' '),
    taille: size ?? null,
    couleur: colour || null,
    matiere: materials.join(', ') || null,
    quincaillerie: hardware?.trim() || null,
    annee: years.length ? years[years.length - 1] : null,
    etat: grade ? `Grade ${grade}` : null,
  }
}

export const num = (s: string | null | undefined) => {
  if (s == null) return null
  const n = Number(String(s).replace(/[\s  ,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

// "USD 80,000 - 100,000" / "HKD 115,200" → { devise, a, b }
export function money(s: string | null | undefined) {
  const m = s?.match(/([A-Z]{3})\s*([\d\s  ,.]+)(?:\s*[-–]\s*(?:[A-Z]{3})?\s*([\d\s  ,.]+))?/)
  if (!m) return { devise: null, a: null, b: null }
  return { devise: m[1], a: num(m[2].replace(/\.(?=\d{3})/g, '')), b: num(m[3]?.replace(/\.(?=\d{3})/g, '')) }
}

if (import.meta.main) {
  const assert = (await import('node:assert')).strict
  const a = parseTitle('A MATTE HIMALAYA NILO CROCODILE BIRKIN 35 BAG WITH PALLADIUM HARDWARE HERMÈS, 2015 GRADE: 1')
  assert.equal(a.modele, 'birkin'); assert.equal(a.taille, '35'); assert.equal(a.quincaillerie, 'palladium')
  assert.equal(a.annee, 2015); assert.equal(a.etat, 'Grade 1'); assert.ok(a.matiere!.includes('crocodile'))
  const b = parseTitle('Craie and Trench Epsom HSS Birkin 25 Sellier Brushed Gold Hardware, 2021')
  assert.equal(b.couleur, 'craie trench'); assert.equal(b.modele, 'birkin sellier'); assert.equal(b.quincaillerie, 'brushed gold')
  const c = parseTitle('Sac à main Hermès  Birkin 35 cm en cuir togo ébène')
  assert.equal(c.taille, '35'); assert.equal(c.couleur, 'ebene'); assert.equal(c.matiere, 'togo, cuir')
  const d = parseTitle('A ROUGE H CALF BIRKIN 35 WITH PALLADIUM HARDWARE HERMÈS, 2012 GRADE: 2.5 includes felt protector, dustbag and box')
  assert.equal(d.matiere, 'calf'); assert.equal(d.etat, 'Grade 2.5')
  assert.deepEqual(money('USD 80,000 - 100,000'), { devise: 'USD', a: 80000, b: 100000 })
  assert.deepEqual(money('HKD 115,200'), { devise: 'HKD', a: 115200, b: null })
  console.log('parse ok')
}
