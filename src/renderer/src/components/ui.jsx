import { money, percent, ROLES, SPEND_ROLES } from '../lib/calc.js'
import { roleColor } from '../lib/roles.js'

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, note, tone }) {
  return (
    <div className="stat glow glow-soft">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${tone ? ` tone-${tone}` : ''}`}>{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

/** Sum of section targets per spending role (null when no section sets one). */
export function roleTargets(sections) {
  const out = {}
  for (const role of SPEND_ROLES) {
    const ts = sections.filter((s) => s.role === role && s.target != null)
    out[role] = ts.length ? ts.reduce((a, s) => a + s.target, 0) : null
  }
  return out
}

/** Actual share of take-home per spending role, with the target as a tick mark. */
export function TargetBars({ evaluation, divisor = 1 }) {
  const { totals, roleTotals, sections } = evaluation
  const targets = roleTargets(sections)
  const base = totals.takehome
  const rows = SPEND_ROLES.map((role) => ({ role, label: ROLES[role].short, value: roleTotals[role], target: targets[role] }))
  rows.push({ role: totals.leftover >= 0 ? 'leftover' : 'shortfall', label: totals.leftover >= 0 ? 'Unallocated' : 'Over budget', value: Math.abs(totals.leftover), target: null })
  const max = Math.max(1, ...rows.map((r) => (base > 0 ? r.value / base : 0)), ...rows.map((r) => r.target ?? 0))

  return (
    <div className="target-bars">
      {rows.map((r) => {
        const share = base > 0 ? r.value / base : 0
        const delta = r.target != null ? share - r.target : null
        return (
          <div className="target-row" key={r.role}>
            <div className="target-head">
              <span className="swatch" style={{ background: roleColor(r.role), color: roleColor(r.role) }} />
              <span className="target-label">{r.label}</span>
              <span className="target-amount">{money(r.value / divisor)}</span>
              <span className="target-share">{percent(share)}</span>
            </div>
            <div className="target-track">
              <div className="target-fill" style={{ width: `${(Math.min(share, max) / max) * 100}%`, background: roleColor(r.role) }} />
              {r.target != null && <div className="target-tick" style={{ left: `${(r.target / max) * 100}%` }} title={`Target ${percent(r.target, 0)}`} />}
            </div>
            {r.target != null && (
              <div className="target-note">
                target {percent(r.target, 0)} · {Math.abs(delta) < 0.005 ? 'on target' : `${delta > 0 ? 'over' : 'under'} by ${percent(Math.abs(delta))} (${money((Math.abs(delta) * base) / divisor)})`}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
