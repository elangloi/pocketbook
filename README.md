# Pocketbook

A local-first budget app for planning a year at a time. You write a Numi-style
calculator sheet, and Pocketbook turns it into cash-flow diagrams, pie charts,
and a Coast FIRE projection.

Nothing goes to the cloud. Each budget is a JSON file on disk.

## Run it

```bash
npm install
npm run dev        # the desktop app, with hot reload
npm test           # tests for the calculator engine and Coast FIRE math
npm run web        # only the UI in a browser (data goes to localStorage), for fast UI work
npm run dist       # build a macOS .dmg into dist/
```

## Where your data lives

`~/Library/Application Support/Pocketbook/budgets/<name>.pocketbook.json`

- Writes are atomic: Pocketbook writes a temp file, then renames it.
- Once a day, the previous version is copied to `budgets/.backups/`.
- Deleting a budget moves its file to the macOS Trash.
- To keep the files somewhere else, use **Change folder** in the sidebar. A
  synced folder like Dropbox works if you want that, but none is the default.

## The sheet

```
# Income
salary = 145k
bonus = 8% of salary

# Necessities @need 50%
rent = 2,350 monthly
Car insurance: 1,100

# Scratch
leftover / 12
savings rate = (retirement + savings) as % of gross
```

- **Sections** start with `#`. Pocketbook guesses each section's role from its
  title. To set the role yourself, add `@income`, `@pretax`, `@retirement`,
  `@tax`, `@need`, `@save` or `@want`. A trailing `50%` sets the section's
  target share of take-home pay.
- **Items** are the named lines (`name = …` or `Label: …`) inside a role
  section. Lines starting with `_`, percentages, and `sum`/`total` lines never
  count as items.
- **Amounts are yearly.** Add `monthly`, `weekly`, `biweekly`, `/mo` or
  `per week` to convert.
- **Math:** `+ - * / ^`, parentheses, `120k`, `1.2m`, `$1,234`, `20% of x`,
  `x + 10%`, `a as % of b`, `sum`, `prev`, plus `round` `min` `max` `floor`
  `ceil` `abs` `sqrt`.
- **Built-in variables:** `gross` `pretax` `retirement` `taxes` `taxable`
  `takehome` `needs` `savings` `wants` `allocated` `leftover`. Every section
  name is also a variable, e.g. `wants_flex`.
- **Federal tax helpers** (2026 estimates, so check them against your pay
  stub): `fedtax(x)`, `fedtax_mfj(x)`, `fica(wages)`, `stddeduction`,
  `stddeduction_mfj`.
- **Maryland tax helpers** (2026 schedule from the Comptroller of Maryland's
  *Withholding Tax Facts, Jan–Dec 2026*):
  - `mdtaxable(agi)` subtracts the $3,350 standard deduction and the $3,200
    personal exemption. The exemption phases out above $100k AGI. Use
    `mdtaxable_mfj` for joint returns ($6,700 deduction, phaseout above $150k).
  - `mdtax(x)` / `mdtax_mfj(x)` apply the state brackets: 2% up to 4.75%, then
    5–5.75% from $100k single / $150k joint, plus the new 6.25% and 6.5% top
    brackets.
  - County tax is a flat share of Maryland taxable income in most counties, so
    write it as `county = 3.2% of _md_taxable`. 3.2% covers Montgomery, Prince
    George's, Howard, Baltimore County and Baltimore City. Two counties use
    graduated rates and have their own functions: `annearundel(x)` and
    `frederick(x)`, each with an `_mfj` version.

Each new year, use **+ → Duplicate current**. A budget named `2026` becomes `2027`.

## Mortgage

The Mortgage tab draws a balance burndown chart (scheduled payments vs. with
extra principal) and a stacked chart of principal vs. interest for each year.
It shows your payoff date, interest saved, today's balance, PMI (which drops
off at 78% loan-to-value) and a yearly schedule. It can also copy a
`mortgage = … monthly` line to paste into your sheet.

## Coast FIRE

Coast FIRE is the point where your current investments will grow to your
retirement number with no more contributions. Every input accepts sheet math,
so `spending = needs + wants` stays linked to your budget. All math uses real
(inflation-adjusted) returns, in today's dollars.

## Stack

Electron + electron-vite + React (plain JS). The charts are hand-rolled SVG,
using `d3-sankey` for the flow layout and `d3-shape` for arcs and lines.

| Path | What |
|---|---|
| `src/main/index.js` | window and the file store (IPC handlers) |
| `src/preload/index.js` | exposes `window.pocketbook` to the UI |
| `src/renderer/src/lib/calc.js` | the calculator engine (tokenizer, parser, sheet evaluator) |
| `src/renderer/src/lib/flow.js` | sheet → Sankey nodes/links |
| `src/renderer/src/lib/coast.js` | Coast FIRE projection |
| `src/renderer/src/views/*` | Sheet, Cash flow, Breakdown, Coast FIRE |
