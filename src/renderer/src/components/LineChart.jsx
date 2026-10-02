import { useState } from 'react'
import { area, line } from 'd3-shape'
import { money } from '../lib/calc.js'
import useSize from '../lib/useSize.js'

const M = { top: 16, right: 24, bottom: 32, left: 64 }

function niceTicks(max, count = 5) {
  if (max <= 0) return [0]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)
  const ticks = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/**
 * series: [{ key, label, color, dashed?, values: [{x, y}] }]
 * refs: [{ y, label }] horizontal reference lines
 * markers: [{ x, y, label, color }]
 */
export default function LineChart({ series, refs = [], markers = [], height = 340, xLabel = (x) => x, tooltipLabel, xTickMultiple = 1, xTickOffset = 0 }) {
  const [ref, { width }] = useSize()
  const [hoverX, setHoverX] = useState(null)

  const xs = series[0]?.values.map((v) => v.x) ?? []
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const yMax = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v.y)), ...refs.map((r) => r.y))
  const yTicks = niceTicks(yMax)
  const top = yTicks[yTicks.length - 1]
  const w = Math.max(0, width - M.left - M.right)
  const h = height - M.top - M.bottom
  const sx = (x) => M.left + (x1 === x0 ? 0 : ((x - x0) / (x1 - x0)) * w)
  const sy = (y) => M.top + h - (y / top) * h
  const path = line().x((d) => sx(d.x)).y((d) => sy(d.y))
  const wash = area().x((d) => sx(d.x)).y0(M.top + h).y1((d) => sy(d.y))
  let xStep = Math.max(1, Math.ceil((x1 - x0) / Math.max(2, Math.floor(w / 70))))
  xStep = Math.ceil(xStep / xTickMultiple) * xTickMultiple
  const xTicks = []
  for (let x = x0 + xTickOffset; x <= x1; x += xStep) xTicks.push(x)

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    const x = Math.round(x0 + ((px - M.left) / w) * (x1 - x0))
    setHoverX(Math.max(x0, Math.min(x1, x)))
  }

  return (
    <div className="chart" ref={ref}>
      {width > 0 && xs.length > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHoverX(null)} role="img" aria-label="Portfolio projection">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + w} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'axis-base' : 'grid'} />
              <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="axis-label">{money(t, { compact: true })}</text>
            </g>
          ))}
          {xTicks.map((x) => (
            <text key={x} x={sx(x)} y={M.top + h + 20} textAnchor="middle" className="axis-label">{xLabel(x)}</text>
          ))}
          {refs.map((r) => (
            <g key={r.label}>
              <line x1={M.left} x2={M.left + w} y1={sy(r.y)} y2={sy(r.y)} className="ref-line" />
              <text x={M.left + 6} y={sy(r.y) - 6} className="ref-label">{r.label}</text>
            </g>
          ))}
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`wash-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.12} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {series.filter((s) => !s.dashed).map((s) => (
            <path key={s.key} d={wash(s.values)} fill={`url(#wash-${s.key})`} />
          ))}
          {series.map((s) => (
            <path
              key={s.key}
              d={path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : null}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={s.dashed ? null : 'glow-line'}
              style={{ '--line-color': s.color }}
            />
          ))}
          {markers.map((m) => (
            <g key={m.label}>
              <circle cx={sx(m.x)} cy={sy(m.y)} r={5} fill={m.color} stroke="var(--surface)" strokeWidth={2} />
              <text x={sx(m.x)} y={sy(m.y) - 12} textAnchor="middle" className="marker-label">{m.label}</text>
            </g>
          ))}
          {hoverX != null && (
            <g pointerEvents="none">
              <line x1={sx(hoverX)} x2={sx(hoverX)} y1={M.top} y2={M.top + h} className="crosshair" />
              {series.map((s) => {
                const p = s.values.find((v) => v.x === hoverX)
                return p ? <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null
              })}
            </g>
          )}
        </svg>
      )}
      {hoverX != null && (
        <div className="tooltip" style={{ left: Math.min(sx(hoverX) + 14, width - 230), top: M.top }}>
          <div className="tooltip-title">{(tooltipLabel ?? xLabel)(hoverX)}</div>
          {series.map((s) => {
            const p = s.values.find((v) => v.x === hoverX)
            return p ? (
              <div className="tooltip-row" key={s.key}>
                <span><span className="swatch" style={{ background: s.color, color: s.color }} />{s.label}</span>
                <span>{money(p.y, { compact: true })}</span>
              </div>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}
