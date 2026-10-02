// Turns an evaluated sheet into Sankey nodes + links:
//   income items → Gross pay → Taxes / Pre-tax / Retirement / Take-home
//   Take-home → each spending section (+ Unallocated) → line items
import { ROLES, SPEND_ROLES } from './calc.js'

export function buildFlow(evaluation, { showItems = true } = {}) {
  const { sections, totals } = evaluation
  const nodes = []
  const links = []
  const add = (node) => {
    nodes.push({ ...node, index: nodes.length })
    return nodes.length - 1
  }
  const link = (source, target, value, role) => {
    if (value > 0.5) links.push({ source, target, value, role })
  }
  const live = (role) => sections.filter((s) => s.role === role && s.total > 0.5)

  const incomeItems = live('income').flatMap((s) => s.items).filter((i) => i.value > 0.5)
  if (totals.gross <= 0.5) return { nodes: [], links: [], empty: true }

  const gross = add({ id: 'gross', name: 'Gross pay', role: 'income', kind: 'hub' })
  if (showItems && incomeItems.length > 0) {
    const sources = incomeItems.map((it) => add({ id: `item-${it.id}`, name: it.label, role: 'income' }))
    incomeItems.forEach((it, k) => link(sources[k], gross, it.value, 'income'))
  }

  // Deductions first (top), then take-home below, so the deduction line items
  // and the spending sections stack in the same order and their bands don't cross.
  for (const role of ['tax', 'pretax', 'retirement']) {
    const secs = live(role)
    for (const s of secs) {
      const node = add({ id: `section-${s.id}`, name: secs.length > 1 ? s.title : ROLES[role].label, role })
      link(gross, node, s.total, role)
      if (showItems) {
        for (const it of s.items) {
          if (it.value <= 0.5) continue
          link(node, add({ id: `item-${it.id}`, name: it.label, role }), it.value, role)
        }
      }
    }
  }

  const takehome = add({ id: 'takehome', name: 'Take-home pay', role: 'income', kind: 'hub' })
  link(gross, takehome, totals.takehome, 'income')

  const overspend = totals.allocated - totals.takehome
  if (overspend > 0.5) {
    const short = add({ id: 'shortfall', name: 'Over budget', role: 'shortfall' })
    link(short, takehome, overspend, 'shortfall')
  }

  for (const role of SPEND_ROLES) {
    for (const s of live(role)) {
      const node = add({ id: `section-${s.id}`, name: s.title, role })
      link(takehome, node, s.total, role)
      if (showItems) {
        for (const it of s.items) {
          if (it.value <= 0.5) continue
          link(node, add({ id: `item-${it.id}`, name: it.label, role }), it.value, role)
        }
      }
    }
  }

  if (totals.leftover > 0.5) {
    link(takehome, add({ id: 'leftover', name: 'Unallocated', role: 'leftover' }), totals.leftover, 'leftover')
  }

  // Drop nodes that ended up with no links (e.g. zero-value sections).
  const used = new Set(links.flatMap((l) => [l.source, l.target]))
  const keep = nodes.filter((n) => used.has(n.index))
  const remap = new Map(keep.map((n, i) => [n.index, i]))
  return {
    nodes: keep.map((n, i) => ({ ...n, index: i })),
    links: links.map((l) => ({ ...l, source: remap.get(l.source), target: remap.get(l.target) })),
    empty: false
  }
}
