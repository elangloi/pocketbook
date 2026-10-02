import { useMemo, useState } from 'react'
import { sankey, sankeyLeft, sankeyLinkHorizontal } from 'd3-sankey'
import { money, percent } from '../lib/calc.js'
import { roleColor } from '../lib/roles.js'
import useSize from '../lib/useSize.js'

const MARGIN = { top: 12, right: 210, bottom: 12, left: 150 }

export default function Sankey({ flow, gross, takehome, divisor = 1, unit = '' }) {
  const [ref, { width }] = useSize()
  const [hover, setHover] = useState(null) // { type, index, x, y }

  const leaves = flow.nodes.filter((n) => !flow.links.some((l) => l.source === n.index)).length
  const height = Math.max(480, leaves * 30 + MARGIN.top + MARGIN.bottom)

  const graph = useMemo(() => {
    if (!width || flow.empty) return null
    const layout = sankey()
      .nodeId((d) => d.index)
      .nodeAlign(sankeyLeft)
      .nodeSort(null)
      .linkSort(null)
      .nodeWidth(8)
      .nodePadding(12)
      .extent([[MARGIN.left, MARGIN.top], [Math.max(MARGIN.left + 200, width - MARGIN.right), height - MARGIN.bottom]])
    return layout({ nodes: flow.nodes.map((n) => ({ ...n })), links: flow.links.map((l) => ({ ...l })) })
  }, [flow, width, height, leaves])

  const path = sankeyLinkHorizontal()
  const fmt = (v) => money(v / divisor)

  const activeLinks = useMemo(() => {
    if (!hover || !graph) return null
    if (hover.type === 'link') return new Set([hover.index])
    const set = new Set()
    graph.links.forEach((l, i) => {
      if (l.source.index === hover.index || l.target.index === hover.index) set.add(i)
    })
    return set
  }, [hover, graph])

  const move = (type, index) => (e) => {
    const box = ref.current.getBoundingClientRect()
    setHover({ type, index, x: e.clientX - box.left, y: e.clientY - box.top })
  }

  let tip = null
  if (hover && graph) {
    if (hover.type === 'link') {
      const l = graph.links[hover.index]
      tip = {
        title: `${l.source.name} → ${l.target.name}`,
        value: fmt(l.value) + unit,
        rows: [['of gross', percent(l.value / gross)], ...(takehome > 0 && ['need', 'save', 'want', 'leftover'].includes(l.role) ? [['of take-home', percent(l.value / takehome)]] : [])]
      }
    } else {
      const n = graph.nodes[hover.index]
      tip = {
        title: n.name,
        value: fmt(n.value) + unit,
        rows: [['of gross', percent(n.value / gross)], ...(takehome > 0 && ['need', 'save', 'want', 'leftover'].includes(n.role) ? [['of take-home', percent(n.value / takehome)]] : [])]
      }
    }
  }

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {graph && (
        <svg width={width} height={height} role="img" aria-label="Cash flow from gross pay to categories">
          <defs>
            {graph.links.map((l, i) => (
              <linearGradient key={i} id={`flow-${i}`} gradientUnits="userSpaceOnUse" x1={l.source.x1} x2={l.target.x0}>
                <stop offset="0%" stopColor={roleColor(l.source.role)} />
                <stop offset="100%" stopColor={roleColor(l.role)} />
              </linearGradient>
            ))}
            <filter id="flow-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          {/* soft blurred copy of every band underneath = the glow */}
          <g filter="url(#flow-glow)" opacity={activeLinks ? 0.15 : 0.45} pointerEvents="none">
            {graph.links.map((l, i) =>
              l.role === 'income' ? null : <path key={i} d={path(l)} fill="none" stroke={`url(#flow-${i})`} strokeWidth={Math.max(1, l.width)} />
            )}
          </g>
          <g>
            {graph.links.map((l, i) => (
              <path
                key={i}
                d={path(l)}
                fill="none"
                stroke={`url(#flow-${i})`}
                strokeWidth={Math.max(1, l.width)}
                className="sankey-link"
                opacity={activeLinks ? (activeLinks.has(i) ? 0.7 : 0.06) : l.role === 'income' ? 0.13 : 0.42}
                onMouseMove={move('link', i)}
              />
            ))}
          </g>
          <g>
            {graph.nodes.map((n) => {
              const leftLabel = n.depth === 0 && graph.nodes.some((m) => m.depth > 0)
              const h = Math.max(1, n.y1 - n.y0)
              const tall = h >= 30
              const dim = activeLinks && hover.type === 'node' && hover.index !== n.index && ![...activeLinks].some((i) => graph.links[i].source.index === n.index || graph.links[i].target.index === n.index)
              return (
                <g key={n.index} opacity={dim ? 0.35 : 1} onMouseMove={move('node', n.index)}>
                  <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={h} rx={3} fill={roleColor(n.role)} className="sankey-node" style={{ '--node-color': roleColor(n.role) }} />
                  <rect x={n.x0 - 6} y={n.y0 - 2} width={n.x1 - n.x0 + 12} height={h + 4} fill="transparent" />
                  <text
                    x={leftLabel ? n.x0 - 8 : n.x1 + 8}
                    y={(n.y0 + n.y1) / 2}
                    textAnchor={leftLabel ? 'end' : 'start'}
                    className={`sankey-label${n.kind === 'hub' ? ' sankey-hub' : ''}`}
                    dy={tall ? '-0.25em' : '0.35em'}
                  >
                    <tspan>{n.name}</tspan>
                    {tall ? (
                      <tspan x={leftLabel ? n.x0 - 8 : n.x1 + 8} dy="1.25em" className="sankey-value">{fmt(n.value)}</tspan>
                    ) : (
                      <tspan className="sankey-value" dx="6">{fmt(n.value)}</tspan>
                    )}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      )}
      {tip && (
        <div className="tooltip" style={{ left: Math.min(hover.x + 14, width - 220), top: hover.y + 14 }}>
          <div className="tooltip-title">{tip.title}</div>
          <div className="tooltip-value">{tip.value}</div>
          {tip.rows.map(([k, v]) => (
            <div className="tooltip-row" key={k}><span>{k}</span><span>{v}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}
