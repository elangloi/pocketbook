import Editor from '../components/Editor.jsx'
import { Stat, TargetBars } from '../components/ui.jsx'
import { money, percent } from '../lib/calc.js'

export default function SheetView({ doc, evaluation, onChange }) {
  const { totals } = evaluation
  const saved = totals.retirement + totals.savings
  return (
    <div className="sheet-view">
      <Editor value={doc.sheet} onChange={(sheet) => onChange({ ...doc, sheet })} evaluation={evaluation} />
      <aside className="summary">
        <div className="stats stats-2">
          <Stat label="Gross pay" value={money(totals.gross)} note={`${money(totals.gross / 12)} a month`} />
          <Stat label="Take-home" value={money(totals.takehome / 12)} note="a month" />
          <Stat
            label={totals.leftover >= 0 ? 'Unallocated' : 'Over budget'}
            value={money(Math.abs(totals.leftover) / 12)}
            note="a month"
            tone={totals.leftover < 0 ? 'critical' : null}
          />
          <Stat label="Savings rate" value={totals.gross > 0 ? percent(saved / totals.gross) : '—'} note="retirement + savings ÷ gross" />
        </div>

        <section className="panel">
          <h3>Take-home split <span className="muted">monthly</span></h3>
          <TargetBars evaluation={evaluation} divisor={12} />
        </section>

        <details className="panel cheatsheet">
          <summary>Syntax cheatsheet</summary>
          <dl>
            <dt><code># Rent &amp; bills @need 50%</code></dt>
            <dd>Section header. Role is guessed from the name, or set with <code>@income</code> <code>@pretax</code> <code>@retirement</code> <code>@tax</code> <code>@need</code> <code>@save</code> <code>@want</code>. A trailing % is the target share of take-home.</dd>
            <dt><code>rent = 2,350 monthly</code></dt>
            <dd>Named lines in a section are budget items. Everything is yearly; <code>monthly</code> <code>weekly</code> <code>biweekly</code> <code>/mo</code> <code>per week</code> convert.</dd>
            <dt><code>Car insurance: 1,100</code></dt>
            <dd>Labels with spaces work too; reference them as <code>car_insurance</code>.</dd>
            <dt><code>bonus = 8% of salary</code></dt>
            <dd>Percent math: <code>x + 10%</code>, <code>x - 5%</code>, <code>a as % of b</code>. Suffixes: <code>120k</code>, <code>1.2m</code>.</dd>
            <dt><code>gross takehome leftover</code></dt>
            <dd>Built-ins: <code>gross</code> <code>pretax</code> <code>retirement</code> <code>taxes</code> <code>taxable</code> <code>takehome</code> <code>needs</code> <code>savings</code> <code>wants</code> <code>allocated</code> <code>leftover</code>, plus every section name (<code>wants_flex</code>).</dd>
            <dt><code>fedtax(taxable - stddeduction)</code></dt>
            <dd>2026 US federal estimate (single; <code>fedtax_mfj</code> for joint). <code>fica(wages)</code> for Social Security + Medicare.</dd>
            <dt><code>mdtax(mdtaxable(taxable))</code></dt>
            <dd>Maryland 2026: <code>mdtaxable</code> takes off the $3,350 standard deduction and the phased-out $3,200 exemption; <code>mdtax</code> applies the 2%–6.5% brackets (<code>_mfj</code> versions for joint). County: <code>3.2% of …</code>, or <code>annearundel()</code> / <code>frederick()</code>.</dd>
            <dt><code>_helper = 12</code></dt>
            <dd>Names starting with <code>_</code>, percentages, and lines using <code>sum</code>/<code>total</code> are never counted as items. <code>// comments</code> anywhere.</dd>
          </dl>
        </details>
      </aside>
    </div>
  )
}
