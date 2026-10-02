import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateSheet, evaluateExpression, inferRole, highlightLine } from '../src/renderer/src/lib/calc.js'
import { coastProjection } from '../src/renderer/src/lib/coast.js'
import { DEMO_SHEET } from '../src/renderer/src/lib/template.js'

const val = (src, scope) => evaluateExpression(src, scope).value
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)

test('arithmetic, suffixes, commas, currency', () => {
  assert.equal(val('2 + 3 * 4'), 14)
  assert.equal(val('(2 + 3) * 4'), 20)
  assert.equal(val('2 ^ 3 ^ 2'), 512)
  assert.equal(val('120k'), 120000)
  assert.equal(val('$1,234.50'), 1234.5)
  assert.equal(val('1.5m / 2'), 750000)
  assert.equal(val('-5 + 2'), -3)
})

test('percent semantics like Numi', () => {
  assert.equal(val('20% of 1000'), 200)
  assert.equal(val('1000 + 10%'), 1100)
  assert.equal(val('1000 - 25%'), 750)
  assert.equal(val('1000 * 5%'), 50)
  const r = evaluateExpression('50 as % of 200')
  assert.equal(r.pct, true)
  assert.equal(r.value, 0.25)
})

test('frequencies annualize', () => {
  assert.equal(val('2,400 monthly'), 28800)
  assert.equal(val('100 weekly'), 5200)
  assert.equal(val('50 /mo'), 600)
  assert.equal(val('10 per day'), 3650)
  assert.equal(val('(1000 + 200) monthly'), 14400)
})

test('functions and tax helpers', () => {
  assert.equal(val('max(3, 9, 4)'), 9)
  assert.equal(val('round(3.14159, 2)'), 3.14)
  close(val('fedtax(12400)'), 1240)
  close(val('fedtax(50400)'), 1240 + 38000 * 0.12)
  close(val('fica(100k)'), 7650)
})

test('maryland 2026 brackets match the Comptroller schedule', () => {
  // Schedule I spot checks: "$4,697.50 plus 5.00% of the excess over $100,000" etc.
  close(val('mdtax(100k)'), 4697.5)
  close(val('mdtax(150k)'), 7260)
  close(val('mdtax(500k)'), 27135)
  close(val('mdtax(1m)'), 58385)
  close(val('mdtax(1.1m)'), 58385 + 6500)
  // Schedule II
  close(val('mdtax_mfj(150k)'), 7072.5)
  close(val('mdtax_mfj(300k)'), 15072.5)
  close(val('mdtax_mfj(1.2m)'), 69822.5)
  // standard deduction + exemption phaseout
  assert.equal(val('mdtaxable(90k)'), 90000 - 3350 - 3200)
  assert.equal(val('mdtaxable(120k)'), 120000 - 3350 - 1600)
  assert.equal(val('mdtaxable(160k)'), 160000 - 3350)
  assert.equal(val('mdtaxable_mfj(160k)'), 160000 - 6700 - 1600)
  // county special cases
  close(val('annearundel(100k)'), 50000 * 0.027 + 50000 * 0.0294)
  close(val('frederick(100k)'), 100000 * 0.0296)
})

test('underscore helpers stay referenceable but are not items', () => {
  const sheet = evaluateSheet('# Taxes\n_base = 1000\nstate = 5% of _base')
  assert.equal(sheet.items.length, 1)
  assert.equal(sheet.items[0].value, 50)
})

test('sheet: variables, sections, items, totals', () => {
  const sheet = evaluateSheet(`# Income
salary = 100k
Side gig: 500 monthly

# Taxes
federal = 15k

# Necessities @need 50%
rent = 2000 monthly
_helper = 12
rate = 5%

# Fun stuff @want
dining = 200 monthly
total

# Scratch
leftover / 12`)
  assert.equal(sheet.totals.gross, 106000)
  assert.equal(sheet.totals.takehome, 91000)
  assert.equal(sheet.totals.needs, 24000)
  assert.equal(sheet.totals.wants, 2400)
  assert.equal(sheet.totals.leftover, 91000 - 26400)
  const needs = sheet.sections.find((s) => s.role === 'need')
  assert.equal(needs.target, 0.5)
  assert.equal(needs.items.length, 1, 'helpers and percents are not counted as items')
  assert.equal(sheet.items.find((i) => i.label === 'Side gig').value, 6000)
  // "total" line sums the block but is not an item
  assert.equal(sheet.lines[14].result.v, 2400)
  assert.equal(sheet.lines[17].result.v, (91000 - 26400) / 12)
  // section totals are variables
  assert.equal(evaluateExpression('fun_stuff', sheet.scope).value, 2400)
})

test('unknown names error on the line only', () => {
  const sheet = evaluateSheet('a = 5\nb = nope + 1\nc = a * 2')
  assert.match(sheet.lines[1].error, /Unknown variable/)
  assert.equal(sheet.lines[2].result.v, 10)
})

test('role inference', () => {
  assert.equal(inferRole('Pre-tax deductions'), 'pretax')
  assert.equal(inferRole('Taxes'), 'tax')
  assert.equal(inferRole('Retirement'), 'retirement')
  assert.equal(inferRole('Wants / flex'), 'want')
  assert.equal(inferRole('Savings goals'), 'save')
  assert.equal(inferRole('Necessities'), 'need')
  assert.equal(inferRole('Scratch'), null)
})

test('highlighter preserves every character', () => {
  for (const line of DEMO_SHEET.split('\n')) {
    assert.equal(highlightLine(line, new Set()).map((s) => s.t).join(''), line)
  }
})

test('demo sheet evaluates without errors', () => {
  const sheet = evaluateSheet(DEMO_SHEET)
  const errors = sheet.lines.filter((l) => l.error)
  assert.deepEqual(errors, [])
  assert.ok(sheet.totals.takehome > 0)
  assert.ok(sheet.totals.leftover >= 0)
})

test('coast fire math', () => {
  const p = coastProjection({ currentAge: 30, retireAge: 60, invested: 100000, contribution: 20000, spending: 40000, swr: 0.04, nominalReturn: 0.07, inflation: 0.03 })
  const r = 1.07 / 1.03 - 1
  close(p.fireNumber, 1e6)
  close(p.coastNumber, 1e6 / (1 + r) ** 30, 1)
  assert.ok(p.coastAge > 30 && p.coastAge < 60)
  assert.ok(p.fiAge > p.coastAge)
  const already = coastProjection({ currentAge: 30, retireAge: 60, invested: 500000, contribution: 0, spending: 40000, swr: 0.04, nominalReturn: 0.07, inflation: 0.03 })
  assert.equal(already.coastAge, 30)
})

test('mortgage amortization', async () => {
  const { monthlyPayment, amortize, addMonths } = await import('../src/renderer/src/lib/mortgage.js')
  close(monthlyPayment(360000, 0.0625, 360), 2216.58)
  const base = amortize({ principal: 360000, annualRate: 0.0625, months: 360 })
  assert.equal(base.payoffMonths, 360)
  close(base.schedule.at(-1).balance, 0)
  close(base.totalInterest, 2216.58 * 360 - 360000, 5)
  const extra = amortize({ principal: 360000, annualRate: 0.0625, months: 360, extra: 200 })
  assert.ok(extra.payoffMonths < 300 && extra.payoffMonths > 280, `paid off in ${extra.payoffMonths}`)
  assert.ok(extra.totalInterest < base.totalInterest - 80000)
  // PMI stops once balance is 78% of the home value
  const pmi = amortize({ principal: 380000, annualRate: 0.0625, months: 360, pmi: 150, homeValue: 400000 })
  const lastPmi = pmi.schedule.findLastIndex((m) => m.pmi > 0)
  assert.ok(pmi.schedule[lastPmi].balance / 400000 <= 0.78 + 0.002 && pmi.schedule[lastPmi + 1].pmi === 0)
  assert.deepEqual(addMonths({ year: 2025, month: 10 }, 3), { year: 2026, month: 1 })
})
