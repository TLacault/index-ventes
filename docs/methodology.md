# Methodology

How the auction results are found, collected, normalised and stored, and what that means for interpreting the numbers.

## 1. Research question and scope

**Goal:** build a lot-level history of secondary-market prices for Hermès handbags, focusing on the two flagship models, **Birkin** and **Kelly**, so they can be compared by size, leather, colour, hardware, year, condition, auction house and date.

**In scope:** public auction results (sold and unsold lots) with estimates and, where available, the final price.
**Out of scope (for now):** retail resale listings (fixed-price shops), private sales, and brands other than Hermès. The data model already supports them.

## 2. Choosing the sources

Candidate sources were found by searching for auction-result databases and checking where Hermès bag sales actually happen. Two kinds of source came out:

- **Auction houses** that publish their own results (Christie's, Sotheby's, Artcurial, Bonhams, Heritage, Gros & Delettrez, Phillips, Drouot houses). These are the primary source: official prices, lot URLs, recent sales.
- **Aggregators** that compile results from many houses. CollectorSquare's *Lux Price Index* claims about 600,000 results. A sample of 320 Birkin 35 lots on it came from Christie's (49%), Artcurial (14%), Sotheby's (12%), Bonhams (8%), Heritage (8%), Gros & Delettrez (7%), plus Aguttes and Cornette de Saint Cyr.

Selected so far:

| Source | Why |
|---|---|
| Christie's | Largest single seller of Hermès bags at auction (Hong Kong, New York, Paris, London, Geneva); results are public and current. |
| CollectorSquare | One place for many houses, including French houses with no scraper yet. Caveat: its data stops around December 2024. |
| Sotheby's | Second major house for handbags; past results need a logged-in account. |

Further candidates, in order of value: Artcurial, Bonhams, Heritage Auctions, Gros & Delettrez, Phillips, Drouot.com. CollectorSquare already covers most of them up to 2024, so direct scrapers would mainly add 2025–2026 results.

## 3. Collection process

For every source the pipeline is the same:

```
search the site for "birkin" / "kelly"  →  page through all past lots
  →  map each lot to the common Lot record  →  parse the title for missing attributes
  →  upsert into SQLite (keyed by source + lot id)  →  export to Excel
```

### Christie's

Christie's search page loads its results from a JSON search service. The scraper reads the search page to find the current data-source identifier, then requests the sold-lots results 20 at a time, sorted by date, for each keyword. Each result contains the lot number, sale number and location, sale dates, lot URL, title, description (with the condition grade), estimate and price realised. No login is needed.

Christie's *price realised* includes the buyer's premium, so it is stored as **Prix frais inclus**. The hammer price is not published and stays empty.

### CollectorSquare (Lux Price Index)

Each model has an index page (e.g. `/sacs/hermes/birkin-35-cm/lpi`). The scraper visits every Birkin and Kelly model page (sizes 25 to 40, Sellier, Shoulder, Mini, Pochette, So Black, Lakis, Relax…), reads the total number of results, and loads the list 40 lots at a time through the page's own "more results" link.

CollectorSquare only shows titles, estimates and prices to logged-in members; logged out, titles are cut to "HERM" and prices are hidden. The requests therefore run inside a Chrome profile where the user has logged in (`pnpm login`).

Each card gives the auction house and sale reference, sale date, country, lot number, estimate, sold or unsold, the price in local currency, EUR and USD, and CollectorSquare's own classification (model, colour family, material, condition, period). The site does not say whether its price includes fees, so it is stored as **Prix** (hammer column) and not as fees-included.

Lots have no individual page on CollectorSquare, so **Lien URL** points to the model index page.

### Sotheby's

Sotheby's search runs in the browser, and past lots are only listed for logged-in users. The scraper will open the past-lots search pages in the logged-in profile and record the results those pages display. It does not call the search service directly, because that would mean reusing the site's private access key outside the page. *Status: in progress.*

## 4. Normalisation

Auction houses describe a bag in one free-text title, for example:

> Craie and Trench Epsom HSS Birkin 25 Sellier Brushed Gold Hardware, 2021

`src/parse.ts` extracts, in English and French:

| Attribute | Rule |
|---|---|
| Modèle | first known model name (Birkin, Kelly, Constance…) plus variants found (Sellier, Retourné, Shoulder, Mini, Cargo, Ghillies…) |
| Taille | the two-digit number following the model name (`Birkin 25`, `Kelly 28 cm`) |
| Matière | every known leather/skin word (Togo, Epsom, Swift, Box, Porosus, Niloticus, Alligator, Ostrich, Lizard…) |
| Quincaillerie | the words before "hardware" (palladium, gold, brushed gold, rose gold, permabrass…) or the French "quincaillerie …" |
| Couleur | English titles: the words before the first leather/model word, minus filler (matte, shiny, limited edition, HSS…). French titles: the word after "en cuir …" |
| Année | the last year between 1940 and 2039 in the title |
| État | Christie's condition grade (`GRADE: 1.5`); CollectorSquare's own condition label when given |

Accessory lists ("includes … dustbag and box") are removed first so that "box" or "felt" are not read as leathers.

Values given directly by a source always win over parsed ones. The original title is kept in **Titre du lot** so any parsed value can be checked.

## 5. Storage

- **SQLite** (`data/lots.sqlite`): one table `lots`, primary key `id = source:lot-id-on-that-source`. Re-running replaces rows, so the data can be refreshed without duplicates.
- **Excel** (`data/lots.xlsx`): regenerated from SQLite on every run, newest sales first, with frozen header, filters and clickable URLs.

## 6. Limitations and how to handle them

- **Fees are not comparable across houses.** Christie's and Sotheby's publish prices *with* buyer's premium; CollectorSquare's price may be the hammer price. Compare like with like (filter on `source` or on which price column is filled), or apply each house's premium schedule.
- **Currencies are not converted.** Prices are kept in the currency of the sale (HKD, USD, EUR, GBP, CHF). Convert at the sale-date rate before averaging.
- **Duplicates across sources.** A Christie's lot can appear both from christies.com and from CollectorSquare. Deduplicate on house + date + lot number before counting volumes.
- **Title parsing is heuristic.** It uses keyword lists, not a full language model: unusual colour names, multi-colour bags and French titles are the most likely misses. Spot-check against `Titre du lot`.
- **Keyword search is broad.** "Kelly" also matches non-bag items (e.g. Grace Kelly photographs, Kelly belts). Filter on `marque = 'Hermès'` and `modele LIKE 'kelly%'`.
- **Coverage bias.** Major houses and Hong Kong / New York sales dominate; small regional sales are under-represented. CollectorSquare data ends in late 2024.
- **Sites change.** The scrapers depend on page and service formats that can change without notice. Christie's stops with an explicit error if its search format changes, and CollectorSquare warns when it looks logged out. Still, spot-check a few rows after each run.

## 7. Ethics and compliance

Only results visible to a normal visitor or to the user's own logged-in account are collected. Requests are spaced about one second apart, and data is stored locally for research. Logins live in a local browser profile (`.profile/`) that is git-ignored and must not be shared.
