import { useMemo, useRef, useState } from 'react'
import { highlightLine, formatNumber, money, ROLES } from '../lib/calc.js'
import { roleColor } from '../lib/roles.js'

// Numi-style editor: a transparent <textarea> sits exactly over a rendered,
// syntax-highlighted copy of the same text. Each rendered row carries its
// result on the right, so results line up with their line even when it wraps.
export default function Editor({ value, onChange, evaluation }) {
  const [copied, setCopied] = useState(null)
  const inputRef = useRef(null)
  const lines = value.split('\n')

  const known = useMemo(() => new Set(Object.keys(evaluation.scope)), [evaluation])

  const copy = (i, text) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(i)
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 900)
  }

  const onKeyDown = (e) => {
    // Tab inserts spaces instead of leaving the editor.
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const { selectionStart: s, selectionEnd: end } = el
      const next = value.slice(0, s) + '  ' + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
    }
  }

  return (
    <div className="editor" onClick={(e) => e.target === e.currentTarget && inputRef.current?.focus()}>
      <div className="editor-body">
        <div className="editor-rows">
          {lines.map((text, i) => {
            const info = evaluation.lines[i] ?? {}
            const section = info.kind === 'header' ? evaluation.sections[info.section] : null
            const item = info.item != null ? evaluation.items[info.item] : null
            let result = null
            let monthly = null
            let accent = null
            if (section) {
              if (section.role) {
                result = money(section.total)
                monthly = money(section.total / 12)
                accent = roleColor(section.role)
              }
            } else if (info.result) {
              result = formatNumber(info.result)
              if (item) {
                monthly = money(item.value / 12)
                accent = roleColor(item.role)
              }
            }
            const showError = info.error && /[\d=+*/]/.test(text)
            return (
              <div key={i} className={`row row-${info.kind ?? 'blank'}${info.error ? ' row-error' : ''}`}>
                <div className="row-text" aria-hidden="true">
                  {accent && <span className="row-accent" style={{ background: accent, color: accent }} />}
                  {text ? highlightLine(text, known).map((s, j) => (
                    <span key={j} className={s.c}>{s.t}</span>
                  )) : ' '}
                  {section?.role && (
                    <span className="row-role">
                      {ROLES[section.role].short}
                      {section.target != null && ` · ${Math.round(section.target * 100)}% target`}
                    </span>
                  )}
                </div>
                <div className="row-result">
                  {result && (
                    <button
                      className={`result${section ? ' result-header' : ''}`}
                      title="Click to copy"
                      onClick={() => copy(i, section ? String(Math.round(section.total)) : String(info.result.pct ? info.result.v * 100 : info.result.v))}
                    >
                      {copied === i ? 'Copied' : result}
                    </button>
                  )}
                  {showError && <span className="result-error" title={info.error}>?</span>}
                </div>
                <div className="row-monthly">{monthly && <span>{monthly}<small>/mo</small></span>}</div>
              </div>
            )
          })}
        </div>
        <textarea
          ref={inputRef}
          className="editor-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Budget sheet"
        />
      </div>
    </div>
  )
}
