import { useMemo, useState } from 'react'
import Sankey from '../components/Sankey.jsx'
import { Segmented } from '../components/ui.jsx'
import { buildFlow } from '../lib/flow.js'
import { money, ROLES } from '../lib/calc.js'
import { roleColor } from '../lib/roles.js'

const LEGEND = ['income', 'tax', 'pretax', 'retirement', 'need', 'save', 'want', 'leftover']

export default function FlowView({ evaluation }) {
  const [period, setPeriod] = useState('year')
  const [showItems, setShowItems] = useState(true)
  const flow = useMemo(() => buildFlow(evaluation, { showItems }), [evaluation, showItems])
  const divisor = period === 'month' ? 12 : 1
  const { totals } = evaluation

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Annual flow <i /> live from your sheet</div>
          <h2>Cash flow</h2>
          <p className="muted">
            {money(totals.gross / divisor)} gross {period === 'month' ? 'a month' : 'a year'}, {money(totals.takehome / divisor)} take-home. Hover any band for details.
          </p>
        </div>
        <div className="controls">
          <label className="toggle">
            <input type="checkbox" checked={showItems} onChange={(e) => setShowItems(e.target.checked)} /> Line items
          </label>
          <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: 'year', label: 'Yearly' }, { value: 'month', label: 'Monthly' }]} />
        </div>
      </header>
      <ul className="legend legend-inline">
        {LEGEND.map((r) => (
          <li key={r}>
            <span className="swatch" style={{ background: roleColor(r), color: roleColor(r) }} />
            {r === 'income' ? 'Income' : r === 'leftover' ? 'Unallocated' : ROLES[r].short}
          </li>
        ))}
      </ul>
      <div className="card card-flush">
        {flow.empty ? (
          <p className="empty">Add an <code># Income</code> section with a salary to see your cash flow.</p>
        ) : (
          <Sankey flow={flow} gross={totals.gross} takehome={totals.takehome} divisor={divisor} />
        )}
      </div>
    </div>
  )
}
