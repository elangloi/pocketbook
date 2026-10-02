import { useState } from 'react'
import { arc, pie } from 'd3-shape'
import { money, percent } from '../lib/calc.js'

// Donut + legend. Slices: [{ key, label, value, color }]
export default function Donut({ slices, total, centerLabel, centerValue, divisor = 1, unit = '', size = 220 }) {
  const [hover, setHover] = useState(null)
  const data = slices.filter((s) => s.value > 0.5)
  const sum = total ?? data.reduce((a, s) => a + s.value, 0)
  const radius = size / 2
  const arcs = pie().sort(null).value((d) => d.value).padAngle(0.014)(data)
  const shape = arc().innerRadius(radius * 0.64).outerRadius(radius - 2).cornerRadius(3)
  const hoverShape = arc().innerRadius(radius * 0.64).outerRadius(radius).cornerRadius(3)
  const active = hover != null ? data[hover] : null

  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`${-radius} ${-radius} ${size} ${size}`} role="img" aria-label={centerLabel}>
        <g className="donut-halo" aria-hidden="true">
          {arcs.map((a) => <path key={a.data.key} d={shape(a)} fill={a.data.color} />)}
        </g>
        {arcs.map((a, i) => (
          <path
            key={a.data.key}
            d={(hover === i ? hoverShape : shape)(a)}
            fill={a.data.color}
            opacity={hover != null && hover !== i ? 0.45 : 1}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text className="donut-center-label" y={-8} textAnchor="middle">{active ? active.label : centerLabel}</text>
        <text className="donut-center-value" y={18} textAnchor="middle">
          {active ? percent(active.value / sum) : money((centerValue ?? sum) / divisor, { compact: true }) + unit}
        </text>
      </svg>
      <ul className="legend">
        {data.map((s, i) => (
          <li
            key={s.key}
            className={hover === i ? 'is-active' : ''}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="swatch" style={{ background: s.color, color: s.color }} />
            <span className="legend-label">{s.label}</span>
            <span className="legend-value">{money(s.value / divisor)}</span>
            <span className="legend-pct">{percent(s.value / sum)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
