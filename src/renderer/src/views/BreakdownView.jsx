import { useState } from 'react'
import Donut from '../components/Donut.jsx'
import { Segmented, Stat, TargetBars } from '../components/ui.jsx'
import { money, percent, ROLES, SPEND_ROLES } from '../lib/calc.js'
import { roleColor } from '../lib/roles.js'

export default function BreakdownView({ evaluation }) {
  const [period, setPeriod] = useState('year')
  const divisor = period === 'month' ? 12 : 1
  const { totals, roleTotals, sections, items } = evaluation

  const grossSlices = [
    ...['tax', 'pretax', 'retirement', 'need', 'save', 'want'].map((role) => ({ key: role, label: ROLES[role].short, value: roleTotals[role], color: roleColor(role) })),
    { key: 'leftover', label: 'Unallocated', value: Math.max(0, totals.leftover), color: roleColor('leftover') }
  ]
  const takehomeSlices = [
    ...SPEND_ROLES.map((role) => ({ key: role, label: ROLES[role].short, value: roleTotals[role], color: roleColor(role) })),
    { key: 'leftover', label: 'Unallocated', value: Math.max(0, totals.leftover), color: roleColor('leftover') }
  ]
  const spendSections = sections.filter((s) => s.role && s.items.length && s.role !== 'income')

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Allocation <i /> share of every dollar</div>
          <h2>Breakdown</h2>
          <p className="muted">Where every dollar of income goes, as a share of gross and of take-home.</p>
        </div>
        <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: 'year', label: 'Yearly' }, { value: 'month', label: 'Monthly' }]} />
      </header>

      <div className="stats stats-4">
        <Stat label="Gross pay" value={money(totals.gross / divisor)} note={period === 'month' ? 'a month' : 'a year'} />
        <Stat label="Take-home" value={money(totals.takehome / divisor)} note={totals.gross > 0 ? `${percent(totals.takehome / totals.gross)} of gross` : ''} />
        <Stat label="Savings rate" value={totals.gross > 0 ? percent((totals.retirement + totals.savings) / totals.gross) : '—'} note="retirement + savings ÷ gross" />
        <Stat label="Effective tax rate" value={totals.gross > 0 ? percent(totals.taxes / totals.gross) : '—'} note="all taxes ÷ gross" />
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Gross pay</h3>
          <Donut slices={grossSlices} total={Math.max(totals.gross, totals.allocated + totals.taxes + totals.pretax + totals.retirement)} centerLabel="Gross" centerValue={totals.gross} divisor={divisor} />
        </section>
        <section className="card">
          <h3>Take-home split vs. targets</h3>
          <Donut slices={takehomeSlices} total={Math.max(totals.takehome, totals.allocated)} centerLabel="Take-home" centerValue={totals.takehome} divisor={divisor} />
          <TargetBars evaluation={evaluation} divisor={divisor} />
        </section>
      </div>

      <div className="grid-3">
        {spendSections.map((s) => {
          const max = Math.max(...s.items.map((i) => i.value))
          return (
            <section className="card" key={s.id}>
              <h3>
                <span className="swatch" style={{ background: roleColor(s.role), color: roleColor(s.role) }} />
                {s.title}
                <span className="card-total">{money(s.total / divisor)}</span>
              </h3>
              <ul className="bars">
                {[...s.items].sort((a, b) => b.value - a.value).map((it) => (
                  <li key={it.id}>
                    <div className="bar-label"><span>{it.label}</span><span>{money(it.value / divisor)}</span></div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(it.value / max) * 100}%`, background: roleColor(s.role) }} /></div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <section className="card">
        <h3>Every line item</h3>
        <table className="table">
          <thead>
            <tr><th>Item</th><th>Category</th><th className="num">Yearly</th><th className="num">Monthly</th><th className="num">% of gross</th><th className="num">% of take-home</th></tr>
          </thead>
          <tbody>
            {items.filter((i) => i.role !== 'income').map((it) => (
              <tr key={it.id}>
                <td>{it.label}</td>
                <td><span className="swatch" style={{ background: roleColor(it.role), color: roleColor(it.role) }} />{sections[it.section].title}</td>
                <td className="num">{money(it.value)}</td>
                <td className="num">{money(it.value / 12)}</td>
                <td className="num">{totals.gross > 0 ? percent(it.value / totals.gross) : '—'}</td>
                <td className="num">{SPEND_ROLES.includes(it.role) && totals.takehome > 0 ? percent(it.value / totals.takehome) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
