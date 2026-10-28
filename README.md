# Index Ventes

A price database of **Hermès Birkin and Kelly bags sold at auction**, built for a luxury-market research assignment.

The scripts collect lot-level results from auction houses and price aggregators, normalise them into one table, and export it to Excel for analysis: what sold, where, when, for how much, against what estimate.

```
 christies.com ──┐
 collectorsquare ─┼──▶  data/lots.sqlite  ──▶  data/lots.xlsx
 sothebys.com ───┘       (one row per lot)       (filterable sheet)
```

## What you get

One row per auction lot, with the fields the research needs:

| Field | Example |
|---|---|
| Maison de vente · Site | Christie's · christies.com |
| Date de vente · N° de lot · Lien URL | 2026-10-06 · 26 · link to the lot page |
| Marque · Modèle · Taille | Hermès · birkin sellier · 30 |
| Couleur · Matière · Quincaillerie | jaune poussin · togo · gold |
| Année de fabrication · État | 2014 · Grade 1.5 |
| Vendu · Estimation basse / haute | Oui · 70 000 / 110 000 |
| Prix · Devise · Prix frais inclus | — · HKD · 128 000 |
| Titre du lot · Remarques | original title, withdrawn / on-request notes |

Full definitions and caveats: [docs/data-dictionary.md](docs/data-dictionary.md).

## Sources

| Source | Coverage | Login | Status |
|---|---|---|---|
| [Christie's](https://www.christies.com/en/search?entry=birkin&tab=sold_lots) | ~5,600 Birkin + ~7,000 Kelly lots, recent sales up to today | no | ✅ working |
| [CollectorSquare – Lux Price Index](https://www.collectorsquare.com/sacs/hermes/birkin-35-cm/lpi) | aggregator: Christie's, Sotheby's, Artcurial, Bonhams, Heritage, Gros & Delettrez, Aguttes… up to Dec 2024 | yes | ✅ written, needs a logged-in profile |
| [Sotheby's](https://www.sothebys.com/en/search?query=birkin) | ~2,600 past Birkin lots and more for Kelly | yes | 🚧 in progress |

How each source is collected, and why: [docs/methodology.md](docs/methodology.md).

## Quick start

Requirements: Node 24+, pnpm, Google Chrome installed.

```bash
pnpm install
pnpm login     # opens Chrome: log in to CollectorSquare and Sotheby's, then close the window
pnpm scrape    # all sources → data/lots.sqlite + data/lots.xlsx
```

Other commands:

```bash
pnpm scrape christies                  # one source
pnpm scrape christies --max-pages 3    # quick sample
pnpm export                            # rebuild data/lots.xlsx from the database
pnpm test                              # self-check of the title parser
```

A full run takes a while on purpose: requests are spaced out (about 1 per second) to stay polite with the sites. Re-running is safe: lots are keyed by source + lot id, so a second run updates rows instead of duplicating them. If a source fails midway, rows already saved are kept.

## Working with the data

- **Excel**: open `data/lots.xlsx`. The header is frozen and filterable; the URL column is clickable.
- **SQL**: `data/lots.sqlite` is a plain SQLite file, e.g.

  ```sql
  SELECT modele, taille, devise, COUNT(*) n, ROUND(AVG(prix_frais_inclus)) avg_price
  FROM lots WHERE vendu = 1 AND modele LIKE 'birkin%'
  GROUP BY modele, taille, devise ORDER BY n DESC;
  ```

Currencies are kept as sold (USD, HKD, EUR, GBP, CHF…). Convert at the sale-date rate before comparing across sales.

## Project layout

```
src/
  cli.ts                  entry point: login | scrape | export
  db.ts                   SQLite schema + upsert (the Lot type is the data model)
  parse.ts                title → model, size, colour, leather, hardware, year, grade
  export.ts               SQLite → Excel
  browser.ts              persistent Chrome profile for logged-in sites
  sources/
    christies.ts
    collectorsquare.ts
    sothebys.ts
docs/
  methodology.md          collection process, per-source notes, limitations
  data-dictionary.md      every column, its origin and caveats
data/                     output (git-ignored)
.profile/                 browser profile with your logins (git-ignored, never share it)
```

## Adding a source

1. Write `src/sources/<site>.ts` exporting an async generator that yields `Lot[]` batches (see `christies.ts` for an HTTP source, `collectorsquare.ts` for one that needs the logged-in browser).
2. Fill what the site gives directly and use `parseTitle()` for the rest.
3. Register it in `src/cli.ts`; if it needs a login, add its login page to `LOGIN_PAGES` in `src/browser.ts`.

## Responsible use

The data is collected for research only. The scripts read only what a visitor (or logged-in account holder) can already see, keep request rates low, and store results locally. Check each site's terms before reusing or republishing the data.
