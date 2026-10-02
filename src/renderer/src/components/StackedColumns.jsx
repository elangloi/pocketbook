import { useState } from 'react'
import { money } from '../lib/calc.js'
import useSize from '../lib/useSize.js'

const M = { top: 12, right: 12, bottom: 28, left: 56 }

/**
 * Stacked columns, bottom-up in `keys` order.
 * data: [{ label, values: { [key]: number } }]
 * keys: [{ key, label, color }]
 */
export default function StackedColumns({ data, keys, height = 240 }) {
  const [ref, { width }] = useSize()
  const [hover, setHover] = useState(null)
  const totals = data.map((d) => keys.reduce((a, k) => a + (d.values[k.key] || 0), 0))
  const max = Math.max(1, ...totals)
  const step = 10 ** Math.floor(Math.log10(max / 4))
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s * 4 >= max)
  const top = nice * 4
  const w = Math.max(0, width - M.left - M.right)
  const h = height - M.top - M.bottom
  const band = data.length ? w / data.length : 0
  const colW = Math.min(24, Math.max(3, band * 0.62))
  const sy = (v) => (v / top) * h
  const labelEvery = Math.max(1, Math.ceil(36 / Math.max(1, band)))

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Yearly principal and interest">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={M.left} x2={M.left + w} y1={M.top + h - sy(nice * i)} y2={M.top + h - sy(nice * i)} className={i === 0 ? 'axis-base' : 'grid'} />
              <text x={M.left - 8} y={M.top + h - sy(nice * i)} dy="0.32em" textAnchor="end" className="axis-label">{money(nice * i, { compact: true })}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = M.left + band * i + band / 2
            let y = M.top + h
            return (
              <g key={d.label} opacity={hover != null && hover !== i ? 0.45 : 1} onMouseEnter={() => setHover(i)}>
                <rect x={M.left + band * i} y={M.top} width={band} height={h} fill="transparent" />
                {keys.map((k, j) => {
                  const v = d.values[k.key] || 0
                  const segH = sy(v)
                  y -= segH
                  const isTop = j === keys.length - 1 || keys.slice(j + 1).every((kk) => !d.values[kk.key])
                  // 2px surface gap between stacked segments
                  const gap = j > 0 && segH > 2 ? 2 : 0
                  return segH > 0 ? (
                    <path
                      key={k.key}
                      d={roundedTop(cx - colW / 2, y, colW, segH - gap, isTop ? Math.min(4, colW / 2, segH) : 0)}
                      fill={k.color}
                    />
                  ) : null
                })}
                {i % labelEvery === 0 && (
                  <text x={cx} y={M.top + h + 18} textAnchor="middle" className="axis-label">{d.label}</text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hover != null && data[hover] && (
        <div className="tooltip" style={{ left: Math.min(M.left + band * hover + band, width - 210), top: 8 }}>
          <div className="tooltip-title">{data[hover].label}</div>
          <div className="tooltip-value">{money(totals[hover])}</div>
          {[...keys].reverse().map((k) => (
            <div className="tooltip-row" key={k.key}>
              <span><span className="swatch" style={{ background: k.color, color: k.color }} />{k.label}</span>
              <span>{money(data[hover].values[k.key] || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function roundedTop(x, y, w, h, r) {
  if (h <= 0) return ''
  if (!r) return `M${x},${y}h${w}v${h}h${-w}z`
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}z`
}
