// Pocketbook's Numi-style calculator engine.
//
// A sheet is plain text evaluated top to bottom. Each line is one of:
//   # Header @role 50%     starts a section; role is inferred from the title if omitted
//   name = expression      assignment; defines a variable (and a budget item inside a role section)
//   Label: expression      labelled line; same as assignment, label is free text
//   expression             scratch math, shown but never counted
//   // comment             ignored (also allowed at the end of any line)
//
// All money is annual. Frequency words convert: `2,400 monthly`, `140 weekly`, `50 /mo`.

export const ROLES = {
  income: { label: 'Income', short: 'Income' },
  pretax: { label: 'Pre-tax deductions', short: 'Pre-tax' },
  retirement: { label: 'Retirement', short: 'Retirement' },
  tax: { label: 'Taxes', short: 'Taxes' },
  need: { label: 'Necessities', short: 'Needs' },
  save: { label: 'Savings goals', short: 'Savings' },
  want: { label: 'Wants / flex', short: 'Wants' }
}

// Spending roles that are carved out of take-home pay.
export const SPEND_ROLES = ['need', 'save', 'want']

const ROLE_ALIASES = {
  income: 'income', salary: 'income', earnings: 'income',
  pretax: 'pretax', deduction: 'pretax', deductions: 'pretax', benefits: 'pretax',
  retirement: 'retirement', retire: 'retirement', '401k': 'retirement',
  tax: 'tax', taxes: 'tax',
  need: 'need', needs: 'need', necessity: 'need', necessities: 'need', fixed: 'need', essentials: 'need',
  save: 'save', saving: 'save', savings: 'save', goals: 'save', goal: 'save',
  want: 'want', wants: 'want', flex: 'want', fun: 'want',
  none: null, scratch: null
}

// Order matters: "Pre-tax deductions" must hit pretax before tax.
const ROLE_INFERENCE = [
  [/retire|401k|403b|pension/i, 'retirement'],
  [/pre-?tax|deduction|benefit|health/i, 'pretax'],
  [/\btax/i, 'tax'],
  [/income|salary|earning|paycheck|wages/i, 'income'],
  [/necessit|\bneeds?\b|essential|fixed|bills/i, 'need'],
  [/saving|goal|invest|fund/i, 'save'],
  [/want|flex|fun|lifestyle|discretionary/i, 'want']
]

export function inferRole(title) {
  for (const [re, role] of ROLE_INFERENCE) if (re.test(title)) return role
  return null
}

const FREQ = {
  daily: 365, day: 365,
  weekly: 52, week: 52, wk: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12, month: 12, mo: 12,
  quarterly: 4, quarter: 4, qtr: 4,
  yearly: 1, annually: 1, annual: 1, year: 1, yr: 1
}
const FREQ_WORDS = new Set(['daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'quarterly', 'yearly', 'annually'])

// ---------------------------------------------------------------------------
// Tax helpers (US federal, 2026 tax year). Estimates only.

const BRACKETS = {
  single: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
  mfj: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]]
}
const SS_WAGE_BASE = 184500

// Maryland, 2026 (Comptroller of Maryland, Withholding Tax Facts Jan–Dec 2026).
// The 6.25% / 6.5% brackets were added in the 2025 session.
const MD_BRACKETS = {
  single: [[1000, 0.02], [2000, 0.03], [3000, 0.04], [100000, 0.0475], [125000, 0.05], [150000, 0.0525], [250000, 0.055], [500000, 0.0575], [1000000, 0.0625], [Infinity, 0.065]],
  mfj: [[1000, 0.02], [2000, 0.03], [3000, 0.04], [150000, 0.0475], [175000, 0.05], [225000, 0.0525], [300000, 0.055], [600000, 0.0575], [1200000, 0.0625], [Infinity, 0.065]]
}
const MD_STD_DEDUCTION = { single: 3350, mfj: 6700 } // flat since tax year 2025

// $3,200 per exemption, phased out by federal AGI.
function mdExemption(agi, status) {
  const start = status === 'mfj' ? 150000 : 100000
  if (agi <= start) return 3200
  if (agi <= start + 25000) return 1600
  if (agi <= start + 50000) return 800
  return 0
}

const mdTaxable = (agi, status) => Math.max(0, agi - MD_STD_DEDUCTION[status] - mdExemption(agi, status))

// Two counties use graduated local rates instead of a flat one.
// Anne Arundel is marginal (each slice at its rate).
const ANNE_ARUNDEL = {
  single: [[50000, 0.027], [400000, 0.0294], [Infinity, 0.032]],
  mfj: [[75000, 0.027], [480000, 0.0294], [Infinity, 0.032]]
}
// Frederick applies one rate to all income, picked by which band income falls in.
const FREDERICK = {
  single: [[25000, 0.0225], [50000, 0.0275], [150000, 0.0296], [Infinity, 0.032]],
  mfj: [[25000, 0.0225], [100000, 0.0275], [250000, 0.0296], [Infinity, 0.032]]
}
const bandRateTax = (income, table) => income * table.find(([upper]) => income <= upper)[1]

function bracketTax(income, table) {
  let tax = 0
  let lower = 0
  for (const [upper, rate] of table) {
    if (income <= lower) break
    tax += (Math.min(income, upper) - lower) * rate
    lower = upper
  }
  return tax
}

function fica(wages, threshold = 200000) {
  const w = Math.max(0, wages)
  return 0.062 * Math.min(w, SS_WAGE_BASE) + 0.0145 * w + 0.009 * Math.max(0, w - threshold)
}

const CONSTANTS = {
  stddeduction: 16100,
  stddeduction_mfj: 32200,
  md_stddeduction: MD_STD_DEDUCTION.single,
  md_stddeduction_mfj: MD_STD_DEDUCTION.mfj,
  pi: Math.PI
}

const num = (v) => ({ v, pct: false })
const pct = (v) => ({ v, pct: true })

const FUNCTIONS = {
  round: (x, d) => num(Math.round(x * 10 ** (d ?? 0)) / 10 ** (d ?? 0)),
  floor: (x) => num(Math.floor(x)),
  ceil: (x) => num(Math.ceil(x)),
  abs: (x) => num(Math.abs(x)),
  sqrt: (x) => num(Math.sqrt(x)),
  min: (...xs) => num(Math.min(...xs)),
  max: (...xs) => num(Math.max(...xs)),
  fedtax: (x) => num(bracketTax(Math.max(0, x), BRACKETS.single)),
  fedtax_mfj: (x) => num(bracketTax(Math.max(0, x), BRACKETS.mfj)),
  fica: (x) => num(fica(x)),
  fica_mfj: (x) => num(fica(x, 250000)),
  mdtaxable: (agi) => num(mdTaxable(agi, 'single')),
  mdtaxable_mfj: (agi) => num(mdTaxable(agi, 'mfj')),
  mdtax: (x) => num(bracketTax(Math.max(0, x), MD_BRACKETS.single)),
  mdtax_mfj: (x) => num(bracketTax(Math.max(0, x), MD_BRACKETS.mfj)),
  annearundel: (x) => num(bracketTax(Math.max(0, x), ANNE_ARUNDEL.single)),
  annearundel_mfj: (x) => num(bracketTax(Math.max(0, x), ANNE_ARUNDEL.mfj)),
  frederick: (x) => num(bandRateTax(Math.max(0, x), FREDERICK.single)),
  frederick_mfj: (x) => num(bandRateTax(Math.max(0, x), FREDERICK.mfj))
}

export const FUNCTION_NAMES = Object.keys(FUNCTIONS)

// ---------------------------------------------------------------------------
// Tokenizer

class CalcError extends Error {}

const NUMBER_RE = /^\$?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?/
const PER_RE = /^(?:per|a|an|each)\s+(day|week|month|quarter|year)\b/i
const SLASH_FREQ_RE = /^\/\s*(day|week|wk|month|mo|quarter|qtr|year|yr)\b/i

function tokenize(src) {
  const tokens = []
  let i = 0
  while (i < src.length) {
    const rest = src.slice(i)
    const ch = src[i]
    if (/\s/.test(ch)) { i++; continue }

    let m = rest.match(SLASH_FREQ_RE) || rest.match(PER_RE)
    if (m) {
      tokens.push({ type: 'freq', value: FREQ[m[1].toLowerCase()] })
      i += m[0].length
      continue
    }

    if (/[\d.$]/.test(ch)) {
      m = rest.match(NUMBER_RE)
      const raw = m && m[0].replace(/[$,]/g, '')
      if (raw && raw !== '.' && raw !== '') {
        let value = parseFloat(raw)
        let len = m[0].length
        const suffix = rest.slice(len).match(/^([kKmM])(?![A-Za-z0-9_])/)
        if (suffix) {
          value *= suffix[1].toLowerCase() === 'k' ? 1e3 : 1e6
          len += 1
        }
        tokens.push({ type: 'num', value })
        i += len
        continue
      }
      if (ch === '$') { i++; continue }
    }

    m = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (m) {
      const word = m[0]
      const lower = word.toLowerCase()
      if (FREQ_WORDS.has(lower)) tokens.push({ type: 'freq', value: FREQ[lower] })
      else if (lower === 'plus') tokens.push({ type: 'op', value: '+' })
      else if (lower === 'minus') tokens.push({ type: 'op', value: '-' })
      else if (lower === 'times') tokens.push({ type: 'op', value: '*' })
      else if (lower === 'of' || lower === 'as') tokens.push({ type: 'kw', value: lower })
      else tokens.push({ type: 'ident', value: word })
      i += word.length
      continue
    }

    if ('+-*/^(),%'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue }
    if (ch === '×') { tokens.push({ type: 'op', value: '*' }); i++; continue }
    if (ch === '÷') { tokens.push({ type: 'op', value: '/' }); i++; continue }
    throw new CalcError(`Unexpected "${ch}"`)
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Pratt parser + evaluator (evaluates while parsing; sheets are tiny)

function infixPower(tok) {
  if (!tok) return 0
  if (tok.type === 'kw' && tok.value === 'as') return 5
  if (tok.type === 'op') {
    if (tok.value === '+' || tok.value === '-') return 10
    if (tok.value === '*' || tok.value === '/') return 20
    if (tok.value === '^') return 40
    if (tok.value === '%') return 50
  }
  if (tok.type === 'kw' && tok.value === 'of') return 25
  if (tok.type === 'freq') return 45
  return 0
}

function evaluateTokens(tokens, lookup, usage) {
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]
  const expectOp = (v) => {
    const t = next()
    if (!t || t.type !== 'op' || t.value !== v) throw new CalcError(`Expected "${v}"`)
  }

  function prefix() {
    const t = next()
    if (!t) throw new CalcError('Incomplete expression')
    if (t.type === 'num') return num(t.value)
    if (t.type === 'op' && t.value === '(') {
      const v = expr(0)
      expectOp(')')
      return v
    }
    if (t.type === 'op' && t.value === '-') {
      const v = expr(30)
      return { v: -v.v, pct: v.pct }
    }
    if (t.type === 'op' && t.value === '+') return expr(30)
    if (t.type === 'ident') {
      const name = t.value.toLowerCase()
      if (peek()?.type === 'op' && peek().value === '(') {
        const fn = FUNCTIONS[name]
        if (!fn) throw new CalcError(`Unknown function ${t.value}()`)
        next()
        const args = []
        if (!(peek()?.type === 'op' && peek().value === ')')) {
          args.push(toNumber(expr(0)))
          while (peek()?.type === 'op' && peek().value === ',') { next(); args.push(toNumber(expr(0))) }
        }
        expectOp(')')
        return fn(...args)
      }
      if (name === 'sum' || name === 'total') usage.aggregate = true
      const v = lookup(name)
      if (v === undefined) throw new CalcError(`Unknown variable "${t.value}"`)
      return v
    }
    throw new CalcError(`Unexpected "${t.value}"`)
  }

  function infix(left, t) {
    if (t.type === 'op' && t.value === '%') return pct(left.v / 100)
    if (t.type === 'freq') return { v: left.v * t.value, pct: left.pct }
    if (t.type === 'kw' && t.value === 'of') {
      const right = expr(25)
      if (!left.pct) throw new CalcError('"of" needs a percentage on the left, e.g. 20% of x')
      return num(left.v * right.v)
    }
    if (t.type === 'kw' && t.value === 'as') {
      // a as % of b
      expectOp('%')
      const of = next()
      if (!of || of.type !== 'kw' || of.value !== 'of') throw new CalcError('Expected "as % of"')
      const right = expr(5)
      return pct(left.v / right.v)
    }
    const op = t.value
    if (op === '^') {
      const right = expr(39)
      return num(left.v ** right.v)
    }
    const right = expr(infixPower(t))
    switch (op) {
      case '+':
        if (!left.pct && right.pct) return num(left.v * (1 + right.v))
        return { v: left.v + right.v, pct: left.pct && right.pct }
      case '-':
        if (!left.pct && right.pct) return num(left.v * (1 - right.v))
        return { v: left.v - right.v, pct: left.pct && right.pct }
      case '*':
        return { v: left.v * right.v, pct: left.pct && right.pct }
      case '/':
        if (right.v === 0) throw new CalcError('Division by zero')
        return { v: left.v / right.v, pct: left.pct && !right.pct }
    }
    throw new CalcError(`Unexpected "${op}"`)
  }

  function expr(minPower) {
    let left = prefix()
    for (;;) {
      const t = peek()
      const p = infixPower(t)
      if (p <= minPower) break
      next()
      left = infix(left, t)
    }
    return left
  }

  const result = expr(0)
  if (pos < tokens.length) throw new CalcError(`Unexpected "${tokens[pos].value}"`)
  return result
}

const toNumber = (val) => val.v

export function slugify(name) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/_+$/g, '')
  return /^[a-z_][a-z0-9_]*$/.test(slug) ? slug : null
}

/** Evaluate a single expression against a scope (used by Coast FIRE inputs). */
export function evaluateExpression(src, scope = {}) {
  const trimmed = String(src ?? '').trim()
  if (!trimmed) return { error: 'Empty' }
  try {
    const lookup = (name) => (name in scope ? scope[name] : name in CONSTANTS ? num(CONSTANTS[name]) : undefined)
    const val = evaluateTokens(tokenize(trimmed), lookup, {})
    if (!Number.isFinite(val.v)) return { error: 'Not a number' }
    return { value: val.v, pct: val.pct }
  } catch (e) {
    return { error: e.message }
  }
}

// ---------------------------------------------------------------------------
// Sheet evaluation

const HEADER_RE = /^(#+)\s*(.*)$/
const ASSIGN_RE = /^([A-Za-z0-9_][A-Za-z0-9_ '&.\-]*?)\s*=(?!=)\s*(.*)$/
const LABEL_RE = /^([^:=]+?):(?:\s+(.*))?$/

function splitComment(line) {
  const idx = line.indexOf('//')
  return idx === -1 ? [line, ''] : [line.slice(0, idx), line.slice(idx)]
}

function parseHeader(rest) {
  let role
  let target = null
  let title = rest
  const roleMatch = title.match(/@([A-Za-z0-9-]+)/)
  if (roleMatch) {
    const key = roleMatch[1].toLowerCase().replace('-', '')
    role = key in ROLE_ALIASES ? ROLE_ALIASES[key] : undefined
    title = title.replace(roleMatch[0], ' ')
  }
  const targetMatch = title.match(/(?:target\s*)?(\d+(?:\.\d+)?)\s*%\s*$/i)
  if (targetMatch && roleMatch) {
    target = parseFloat(targetMatch[1]) / 100
    title = title.slice(0, targetMatch.index)
  }
  title = title.replace(/\s+/g, ' ').trim() || 'Untitled'
  if (role === undefined) role = inferRole(title)
  return { title, role, target }
}

const BUILTIN_NAMES = ['gross', 'pretax', 'retirement', 'taxes', 'taxable', 'takehome', 'net', 'needs', 'savings', 'wants', 'allocated', 'leftover']

function computeTotals(roleTotals) {
  const gross = roleTotals.income
  const takehome = gross - roleTotals.pretax - roleTotals.retirement - roleTotals.tax
  const allocated = roleTotals.need + roleTotals.save + roleTotals.want
  return {
    gross,
    pretax: roleTotals.pretax,
    retirement: roleTotals.retirement,
    taxes: roleTotals.tax,
    taxable: gross - roleTotals.pretax - roleTotals.retirement,
    takehome,
    net: takehome,
    needs: roleTotals.need,
    savings: roleTotals.save,
    wants: roleTotals.want,
    allocated,
    leftover: takehome - allocated
  }
}

/**
 * Evaluate a whole sheet. Returns per-line results plus the structured budget
 * (sections, items, totals) that the charts are built from.
 */
export function evaluateSheet(text) {
  const rawLines = String(text ?? '').split('\n')
  const vars = new Map() // user-defined, lowercase -> value
  const sectionVars = new Map()
  const roleTotals = { income: 0, pretax: 0, retirement: 0, tax: 0, need: 0, save: 0, want: 0 }
  const sections = []
  const items = []
  const lines = []
  let section = null
  let block = []
  let prev

  const builtins = () => computeTotals(roleTotals)
  const lookup = (name) => {
    if (vars.has(name)) return vars.get(name)
    if (name === 'sum' || name === 'total') return num(block.reduce((a, b) => a + b, 0))
    if (name === 'prev' || name === 'ans') return prev
    if (BUILTIN_NAMES.includes(name)) return num(builtins()[name])
    if (sectionVars.has(name)) return num(sectionVars.get(name).total)
    if (name in CONSTANTS) return num(CONSTANTS[name])
    return undefined
  }

  rawLines.forEach((raw, index) => {
    const [code] = splitComment(raw)
    const trimmed = code.trim()
    const line = { index, kind: 'blank', result: null, error: null }
    lines.push(line)

    if (!trimmed) {
      if (!raw.trim()) block = []
      line.kind = raw.trim() ? 'comment' : 'blank'
      return
    }

    const header = trimmed.match(HEADER_RE)
    if (header) {
      const info = parseHeader(header[2])
      section = { id: sections.length, ...info, level: header[1].length, line: index, total: 0, items: [] }
      sections.push(section)
      const slug = slugify(info.title)
      if (slug && !BUILTIN_NAMES.includes(slug) && !vars.has(slug)) sectionVars.set(slug, section)
      Object.assign(line, { kind: 'header', section: section.id })
      block = []
      return
    }

    let name = null
    let label = null
    let exprSrc = trimmed
    const assign = trimmed.match(ASSIGN_RE)
    const labelled = !assign && trimmed.match(LABEL_RE)
    if (assign) {
      label = assign[1].trim()
      exprSrc = assign[2]
    } else if (labelled) {
      label = labelled[1].trim()
      exprSrc = labelled[2] ?? ''
    }
    if (label) name = slugify(label)

    if (label && !exprSrc.trim()) {
      Object.assign(line, { kind: 'label' })
      return
    }

    line.kind = label ? 'named' : 'expr'
    line.name = name
    line.label = label
    try {
      const usage = {}
      const val = evaluateTokens(tokenize(exprSrc), lookup, usage)
      if (!Number.isFinite(val.v)) throw new CalcError('Not a number')
      line.result = val
      prev = val
      if (!val.pct) block.push(val.v)
      if (name) vars.set(name, val)

      const counts = section && section.role && label && !val.pct && !usage.aggregate && !label.startsWith('_')
      if (counts) {
        const item = { id: items.length, label, name, value: val.v, role: section.role, section: section.id, line: index }
        items.push(item)
        section.items.push(item)
        section.total += val.v
        roleTotals[section.role] += val.v
        line.item = item.id
      }
    } catch (e) {
      line.error = e instanceof CalcError ? e.message : 'Could not evaluate'
    }
  })

  const totals = computeTotals(roleTotals)

  // Final scope (for Coast FIRE expressions etc.)
  const scope = {}
  for (const [k, s] of sectionVars) scope[k] = num(s.total)
  for (const k of BUILTIN_NAMES) scope[k] = num(totals[k])
  for (const [k, v] of vars) scope[k] = v

  return { lines, sections, items, totals, roleTotals, scope }
}

// ---------------------------------------------------------------------------
// Syntax highlighting (pure; preserves every character so the overlay lines up)

export function highlightLine(text, knownNames) {
  const spans = []
  const [code, comment] = splitComment(text)
  if (/^\s*#/.test(code)) {
    spans.push({ t: code, c: 'hl-header' })
  } else {
    let rest = code
    const sepIdx = ASSIGN_RE.test(code.trimStart()) ? code.indexOf('=') : LABEL_RE.test(code.trim()) ? code.indexOf(':') : -1
    if (sepIdx > 0) {
      spans.push({ t: code.slice(0, sepIdx), c: 'hl-name' })
      spans.push({ t: code[sepIdx], c: 'hl-op' })
      rest = code.slice(sepIdx + 1)
    }
    const re = /(\$?\d[\d,]*(?:\.\d+)?[kKmM]?\b%?|\$?\.\d+%?)|([A-Za-z_][A-Za-z0-9_]*)|([+\-*/^()%=,×÷])|(\s+)|(.)/g
    let m
    while ((m = re.exec(rest))) {
      if (m[1]) spans.push({ t: m[1], c: 'hl-num' })
      else if (m[2]) {
        const lower = m[2].toLowerCase()
        let c = 'hl-text'
        if (FREQ_WORDS.has(lower) || ['of', 'as', 'per', 'plus', 'minus', 'times'].includes(lower) || lower in FREQ) c = 'hl-kw'
        else if (lower in FUNCTIONS) c = 'hl-fn'
        else if (knownNames?.has(lower) || BUILTIN_NAMES.includes(lower) || lower in CONSTANTS || ['sum', 'total', 'prev', 'ans'].includes(lower)) c = 'hl-var'
        spans.push({ t: m[2], c })
      } else if (m[3]) spans.push({ t: m[3], c: 'hl-op' })
      else spans.push({ t: m[0], c: '' })
    }
  }
  if (comment) spans.push({ t: comment, c: 'hl-comment' })
  return spans
}

// ---------------------------------------------------------------------------
// Formatting

export function formatNumber(val) {
  if (!val) return ''
  if (val.pct) {
    const p = val.v * 100
    return `${Number(p.toFixed(Math.abs(p) < 10 ? 2 : 1)).toLocaleString('en-US')}%`
  }
  const v = val.v
  const abs = Math.abs(v)
  const digits = abs >= 1000 || Number.isInteger(v) ? 0 : abs >= 1 ? 2 : 4
  return v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export function money(v, { compact = false, cents = false } = {}) {
  if (!Number.isFinite(v)) return '—'
  if (compact && Math.abs(v) >= 1000) {
    return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
  }
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 })
}

export function percent(v, digits = 1) {
  if (!Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}
