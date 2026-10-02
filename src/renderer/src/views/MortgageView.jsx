import { useMemo, useState } from 'react'
import LineChart from '../components/LineChart.jsx'
import StackedColumns from '../components/StackedColumns.jsx'
import { Stat } from '../components/ui.jsx'
import { evaluateExpression, money, percent } from '../lib/calc.js'
import { amortize, addMonths, formatMonth, monthsElapsed, parseMonth, MORTGAGE_DEFAULTS, MORTGAGE_FIELDS } from '../lib/mortgage.js'

const duration = (months) => {
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y && `${y} yr`, m && `${m} mo`].filter(Boolean).join(' ') || '0 mo'
}

export default function MortgageView({ doc, evaluation, onChange }) {
  const inputs = { ...MORTGAGE_DEFAULTS, ...doc.mortgage }
  const [copied, setCopied] = useState(false)
  const set = (key, value) => onChange({ ...doc, mortgage: { ...doc.mortgage, [key]: value } })

  const evaluated = useMemo(() => {
    const out = {}
    for (const f of MORTGAGE_FIELDS) {
      if (f.kind === 'month') continue
      const r = evaluateExpression(inputs[f.key], evaluation.scope)
      if (r.error) out[f.key] = { error: r.error }
      else if (f.kind === 'rate') out[f.key] = { value: r.pct || r.value < 1 ? r.value : r.value / 100 }
      else out[f.key] = { value: r.value }
    }
    return out
  }, [doc.mortgage, evaluation])

  const ok = Object.values(evaluated).every((v) => !v.error)
  const v = Object.fromEntries(Object.entries(evaluated).map(([k, x]) => [k, x.value]))
  const loan = ok ? v.price - v.down : 0
  const months = Math.round((v.years || 0) * 12)
  const valid = ok && loan > 0 && months > 0 && v.rate >= 0
  const start = parseMonth(inputs.start)

  const result = useMemo(() => {
    if (!valid) return null
    const base = amortize({ principal: loan, annualRate: v.rate, months, pmi: v.pmi, homeValue: v.price })
    const fast = amortize({ principal: loan, annualRate: v.rate, months, extra: v.extra, pmi: v.pmi, homeValue: v.price })
    return { base, fast }
  }, [valid, loan, v.rate, months, v.extra, v.pmi, v.price])

  if (!result) {
    return (
      <div className="page">
        <MortgageHead />
        <div className="coast-layout">
          <Inputs inputs={inputs} evaluated={evaluated} set={set} onReset={() => onChange({ ...doc, mortgage: {} })} />
          <section className="card"><p className="empty">Fix the highlighted inputs (the loan must be more than $0) to see your schedule.</p></section>
        </div>
      </div>
    )
  }

  const { base, fast } = result
  const escrow = (v.propertyTax + v.insurance) / 12
  const firstPmi = fast.schedule[0]?.pmi ?? 0
  const monthlyTotal = fast.payment + v.extra + escrow + v.hoa + firstPmi
  const payoff = addMonths(start, fast.payoffMonths - 1)
  const saved = base.totalInterest + base.totalPmi - fast.totalInterest - fast.totalPmi
  const monthsSaved = base.payoffMonths - fast.payoffMonths
  const elapsed = monthsElapsed(start)
  const now = elapsed >= 0 && elapsed < fast.payoffMonths ? fast.schedule[elapsed] : null
  const balanceNow = elapsed < 0 ? loan : now ? now.balance : 0

  // Burndown: month index on x, balance on y. Point 0 is the starting loan.
  const toSeries = (sched) => [{ x: 0, y: loan }, ...sched.map((m) => ({ x: m.month + 1, y: m.balance }))]
  const series = [
    { key: 'scheduled', label: 'Scheduled', color: 'var(--c-series-7)', values: toSeries(base.schedule) },
    ...(v.extra > 0 ? [{ key: 'extra', label: `With ${money(v.extra)}/mo extra`, color: 'var(--c-series-3)', values: toSeries(fast.schedule) }] : [])
  ]
  const markers = []
  if (elapsed > 0 && elapsed < fast.payoffMonths) markers.push({ x: elapsed, y: balanceNow, label: 'Today', color: 'var(--ink)' })
  markers.push({ x: fast.payoffMonths, y: 0, label: `Paid off ${payoff.year}`, color: v.extra > 0 ? 'var(--c-series-3)' : 'var(--c-series-7)' })
  const monthLabel = (x) => formatMonth(addMonths(start, x))

  // Calendar-year totals for the principal vs interest columns.
  const years = new Map()
  for (const m of fast.schedule) {
    const { year } = addMonths(start, m.month)
    const row = years.get(year) ?? { principal: 0, interest: 0, pmi: 0, balance: 0 }
    row.principal += m.principal
    row.interest += m.interest
    row.pmi += m.pmi
    row.balance = m.balance
    years.set(year, row)
  }
  const yearly = [...years.entries()].map(([year, values]) => ({ label: String(year), values }))
  const hasPmi = fast.totalPmi > 0

  const sheetLine = `mortgage = ${Math.round(monthlyTotal).toLocaleString('en-US')} monthly`
  const copyLine = () => {
    navigator.clipboard?.writeText(sheetLine).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="page">
      <MortgageHead />
      <div className="coast-layout">
        <Inputs inputs={inputs} evaluated={evaluated} set={set} onReset={() => onChange({ ...doc, mortgage: {} })} />

        <div className="coast-results">
          <section className="card coast-hero glow glow-strong">
            <h2>Paid off {formatMonth(payoff)}.</h2>
            <p>
              {duration(fast.payoffMonths)} from your first payment.
              {v.extra > 0 && monthsSaved > 0
                ? ` Paying ${money(v.extra)} extra a month finishes ${duration(monthsSaved)} early and saves ${money(saved)} in interest${hasPmi ? ' and PMI' : ''}.`
                : ' Add extra principal to see how much sooner you could be done.'}
            </p>
          </section>

          <div className="stats stats-4">
            <Stat label="Monthly payment" value={money(monthlyTotal)} note={`${money(fast.payment)} P&I · ${money(escrow)} tax + ins${v.extra > 0 ? ` · ${money(v.extra)} extra` : ''}`} />
            <Stat label="Loan" value={money(loan)} note={`${percent(loan / v.price, 0)} loan-to-value`} />
            <Stat label="Total interest" value={money(fast.totalInterest)} note={v.extra > 0 ? `vs ${money(base.totalInterest)} on schedule` : `${percent(fast.totalInterest / loan, 0)} of the loan`} />
            <Stat
              label="Balance today"
              value={money(balanceNow)}
              note={elapsed < 0 ? `starts ${formatMonth(start)}` : `${percent(1 - balanceNow / loan, 1)} paid off`}
              tone={balanceNow === 0 ? 'good' : null}
            />
          </div>

          <section className="card">
            <h3>Balance burndown</h3>
            <ul className="legend legend-inline">
              {series.map((s) => (
                <li key={s.key}><span className="swatch" style={{ background: s.color, color: s.color }} />{s.label}</li>
              ))}
            </ul>
            <LineChart
              series={series}
              markers={markers}
              xLabel={(x) => String(addMonths(start, x).year)}
              tooltipLabel={monthLabel}
              xTickMultiple={12}
              xTickOffset={(12 - start.month) % 12}
            />
          </section>

          <section className="card">
            <h3>Where each year’s payments go</h3>
            <ul className="legend legend-inline">
              <li><span className="swatch" style={{ background: 'var(--c-series-1)', color: 'var(--c-series-1)' }} />Principal</li>
              <li><span className="swatch" style={{ background: 'var(--c-series-5)', color: 'var(--c-series-5)' }} />Interest</li>
              {hasPmi && <li><span className="swatch" style={{ background: 'var(--c-series-4)', color: 'var(--c-series-4)' }} />PMI</li>}
            </ul>
            <StackedColumns
              data={yearly}
              keys={[
                { key: 'principal', label: 'Principal', color: 'var(--c-series-1)' },
                { key: 'interest', label: 'Interest', color: 'var(--c-series-5)' },
                ...(hasPmi ? [{ key: 'pmi', label: 'PMI', color: 'var(--c-series-4)' }] : [])
              ]}
            />
            <p className="footnote">
              Add it to your budget:{' '}
              <button className="link-button" onClick={copyLine}>{copied ? 'Copied!' : <code>{sheetLine}</code>}</button>{' '}
              under <code># Necessities</code>.
            </p>
          </section>

          <section className="card">
            <h3>Yearly schedule</h3>
            <table className="table">
              <thead>
                <tr><th>Year</th><th className="num">Principal</th><th className="num">Interest</th>{hasPmi && <th className="num">PMI</th>}<th className="num">Ending balance</th></tr>
              </thead>
              <tbody>
                {yearly.map((y) => (
                  <tr key={y.label}>
                    <td>{y.label}</td>
                    <td className="num">{money(y.values.principal)}</td>
                    <td className="num">{money(y.values.interest)}</td>
                    {hasPmi && <td className="num">{money(y.values.pmi)}</td>}
                    <td className="num">{money(y.values.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  )
}

function MortgageHead() {
  return (
    <header className="page-head">
      <div>
        <div className="eyebrow">Home <i /> fixed-rate loan</div>
        <h2>Mortgage</h2>
        <p className="muted">How your balance burns down, and what extra principal buys you. Fields accept sheet math.</p>
      </div>
    </header>
  )
}

function Inputs({ inputs, evaluated, set, onReset }) {
  return (
    <section className="card coast-inputs">
      {MORTGAGE_FIELDS.map((f) => {
        if (f.kind === 'month') {
          return (
            <label className="field" key={f.key}>
              <span className="field-label">{f.label}</span>
              <input type="month" value={inputs[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              <span className="field-hint">month of your first payment</span>
            </label>
          )
        }
        const ev = evaluated[f.key]
        const shown = ev.error ? ev.error : f.kind === 'rate' ? `= ${percent(ev.value, 3)}` : f.kind === 'years' ? `= ${ev.value} years` : `= ${money(ev.value)}${f.hint ? ` · ${f.hint}` : ''}`
        return (
          <label className="field" key={f.key}>
            <span className="field-label">{f.label}</span>
            <input value={inputs[f.key]} onChange={(e) => set(f.key, e.target.value)} spellCheck={false} />
            <span className={`field-hint${ev.error ? ' is-error' : ''}`}>{shown}</span>
          </label>
        )
      })}
      <button className="link-button" onClick={onReset}>Reset to defaults</button>
    </section>
  )
}
