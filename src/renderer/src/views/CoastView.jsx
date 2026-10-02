import { useMemo } from 'react'
import LineChart from '../components/LineChart.jsx'
import { Stat } from '../components/ui.jsx'
import { evaluateExpression, formatNumber, money, percent } from '../lib/calc.js'
import { coastProjection, COAST_DEFAULTS, COAST_FIELDS } from '../lib/coast.js'

const RATE_FIELDS = new Set(['swr', 'nominalReturn', 'inflation'])

export default function CoastView({ doc, evaluation, onChange }) {
  const inputs = { ...COAST_DEFAULTS, ...doc.coast }

  const evaluated = useMemo(() => {
    const out = {}
    for (const { key } of COAST_FIELDS) {
      const r = evaluateExpression(inputs[key], evaluation.scope)
      if (r.error) out[key] = { error: r.error }
      else if (RATE_FIELDS.has(key)) out[key] = { value: r.pct || r.value <= 1 ? r.value : r.value / 100, pct: true }
      else out[key] = { value: r.value, pct: r.pct }
    }
    return out
  }, [doc.coast, evaluation])

  const ok = Object.values(evaluated).every((v) => !v.error)
  const params = Object.fromEntries(Object.entries(evaluated).map(([k, v]) => [k, v.value]))
  const valid = ok && params.swr > 0 && params.retireAge > params.currentAge
  const p = useMemo(() => (valid ? coastProjection(params) : null), [valid, JSON.stringify(params)])

  const set = (key, value) => onChange({ ...doc, coast: { ...doc.coast, [key]: value } })

  let headline = null
  if (p) {
    if (p.coastAge === params.currentAge) {
      headline = (
        <>
          <h2>You’ve hit Coast FIRE.</h2>
          <p>Even if you never invest another dollar, today’s {money(params.invested)} grows to about {money(p.retireCoastOnly)} by {params.retireAge} — enough for {money(params.spending)} a year.</p>
        </>
      )
    } else if (p.coastAge != null && p.coastAge <= params.retireAge) {
      headline = (
        <>
          <h2>You can coast at {p.coastAge}.</h2>
          <p>
            Keep investing {money(params.contribution)} a year for {p.coastAge - params.currentAge} more {p.coastAge - params.currentAge === 1 ? 'year' : 'years'}. After that, your
            portfolio grows to {money(p.fireNumber)} by {params.retireAge} on its own — you'd only need to earn enough to cover current spending.
          </p>
        </>
      )
    } else {
      headline = (
        <>
          <h2>Not on track to coast before {params.retireAge}.</h2>
          <p>You need {money(p.coastNumber)} invested today. Try a later retirement age, lower retirement spending, or bigger contributions.</p>
        </>
      )
    }
  }

  const series = p
    ? [
        { key: 'balance', label: 'Keep contributing', color: 'var(--c-series-1)', values: p.series.map((d) => ({ x: d.age, y: d.balance })) },
        { key: 'today', label: 'Stop contributing today', color: 'var(--c-series-2)', values: p.series.map((d) => ({ x: d.age, y: d.coastOnly })) },
        { key: 'target', label: 'Coast line (enough to coast)', color: 'var(--ink-3)', dashed: true, values: p.series.filter((d) => d.age <= params.retireAge).map((d) => ({ x: d.age, y: d.target })) }
      ]
    : []
  const coastPoint = p?.coastAge != null && p.coastAge > params.currentAge ? p.series.find((d) => d.age === p.coastAge) : null

  return (
    <div className="page coast">
      <header className="page-head">
        <div>
          <div className="eyebrow">Retirement <i /> today’s dollars</div>
          <h2>Coast FIRE</h2>
          <p className="muted">
            The point where your investments can grow to your retirement number without more contributions. Fields accept sheet math like <code>retirement + roth_ira</code>.
          </p>
        </div>
      </header>

      <div className="coast-layout">
        <section className="card coast-inputs">
          {COAST_FIELDS.map((f) => {
            const ev = evaluated[f.key]
            return (
              <label className="field" key={f.key}>
                <span className="field-label">{f.label}</span>
                <input value={inputs[f.key]} onChange={(e) => set(f.key, e.target.value)} spellCheck={false} />
                <span className={`field-hint${ev.error ? ' is-error' : ''}`}>
                  {ev.error ? ev.error : RATE_FIELDS.has(f.key) ? `= ${percent(ev.value, 1)}` : f.key.endsWith('Age') ? f.hint : `= ${f.key === 'invested' || f.key === 'contribution' || f.key === 'spending' ? money(ev.value) : formatNumber({ v: ev.value })} · ${f.hint}`}
                </span>
              </label>
            )
          })}
          <button className="link-button" onClick={() => onChange({ ...doc, coast: {} })}>Reset to defaults</button>
        </section>

        <div className="coast-results">
          {!valid && <section className="card"><p className="empty">Fix the highlighted inputs to see your projection.</p></section>}
          {p && (
            <>
              <section className="card coast-hero glow glow-strong">{headline}</section>
              <div className="stats stats-4">
                <Stat label="FIRE number" value={money(p.fireNumber)} note={`${money(params.spending)} ÷ ${percent(params.swr, 1)}`} />
                <Stat label="Coast number today" value={money(p.coastNumber)} note={`needed now to coast to ${params.retireAge}`} />
                <Stat label="Progress to coast" value={percent(Math.min(p.progress, 9.99), 0)} note={p.gap > 0 ? `${money(p.gap)} to go` : 'reached'} tone={p.progress >= 1 ? 'good' : null} />
                <Stat label="Fully FI" value={p.fiAge != null ? `age ${p.fiAge}` : '—'} note="if you keep contributing" />
              </div>
              <section className="card">
                <h3>Portfolio in today’s dollars</h3>
                <ul className="legend legend-inline">
                  {series.map((s) => (
                    <li key={s.key}>
                      <span className={`swatch${s.dashed ? ' swatch-dashed' : ''}`} style={{ background: s.dashed ? 'none' : s.color, borderColor: s.color }} />
                      {s.label}
                    </li>
                  ))}
                </ul>
                <LineChart
                  series={series}
                  refs={[{ y: p.fireNumber, label: `FIRE number ${money(p.fireNumber, { compact: true })}` }]}
                  markers={coastPoint ? [{ x: coastPoint.age, y: coastPoint.balance, label: `Coast at ${coastPoint.age}`, color: 'var(--c-series-1)' }] : []}
                  xLabel={(x) => `Age ${x}`}
                />
                <p className="footnote">
                  Real return {percent(p.realReturn, 2)} ({percent(params.nominalReturn, 1)} expected − {percent(params.inflation, 1)} inflation). Contributions are added at the end of each year. This is a planning estimate, not financial advice.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
