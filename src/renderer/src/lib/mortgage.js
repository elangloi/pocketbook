// Fixed-rate mortgage amortization, month by month, with optional extra principal.

export const MORTGAGE_DEFAULTS = {
  price: '450k',
  down: '90k',
  rate: '6.25%',
  years: '30',
  start: '2025-03',
  extra: '200',
  propertyTax: '4,950',
  insurance: '1,800',
  pmi: '0',
  hoa: '0'
}

export const MORTGAGE_FIELDS = [
  { key: 'price', label: 'Home price', kind: 'money' },
  { key: 'down', label: 'Down payment', kind: 'money' },
  { key: 'rate', label: 'Interest rate', kind: 'rate' },
  { key: 'years', label: 'Term', kind: 'years' },
  { key: 'start', label: 'First payment', kind: 'month' },
  { key: 'extra', label: 'Extra principal', kind: 'money', hint: 'per month' },
  { key: 'propertyTax', label: 'Property tax', kind: 'money', hint: 'per year' },
  { key: 'insurance', label: 'Home insurance', kind: 'money', hint: 'per year' },
  { key: 'pmi', label: 'PMI', kind: 'money', hint: 'per month, drops at 78% loan-to-value' },
  { key: 'hoa', label: 'HOA', kind: 'money', hint: 'per month' }
]

export function monthlyPayment(principal, annualRate, months) {
  if (months <= 0) return 0
  const r = annualRate / 12
  if (r === 0) return principal / months
  return (principal * r) / (1 - (1 + r) ** -months)
}

/** Amortize. Returns the schedule plus summary numbers. `extra` is monthly. */
export function amortize({ principal, annualRate, months, extra = 0, pmi = 0, homeValue = principal }) {
  const payment = monthlyPayment(principal, annualRate, months)
  const r = annualRate / 12
  const schedule = []
  let balance = principal
  let totalInterest = 0
  let totalPmi = 0
  for (let m = 0; balance > 0.005 && m < months; m++) {
    const interest = balance * r
    const principalPaid = Math.min(balance, payment - interest + extra)
    const pmiPaid = pmi > 0 && balance / homeValue > 0.78 ? pmi : 0
    balance -= principalPaid
    totalInterest += interest
    totalPmi += pmiPaid
    schedule.push({ month: m, interest, principal: principalPaid, pmi: pmiPaid, balance: Math.max(0, balance) })
  }
  return { payment, schedule, totalInterest, totalPmi, payoffMonths: schedule.length }
}

/** Parse "2025-03" into { year, month (0-11) }; falls back to the current month. */
export function parseMonth(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{1,2})$/)
  if (m) return { year: Number(m[1]), month: Math.min(11, Math.max(0, Number(m[2]) - 1)) }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

export function addMonths({ year, month }, n) {
  const total = year * 12 + month + n
  return { year: Math.floor(total / 12), month: total % 12 }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const formatMonth = ({ year, month }) => `${MONTHS[month]} ${year}`

/** Months between the first payment and today (negative if it hasn't started). */
export function monthsElapsed(start, today = new Date()) {
  return (today.getFullYear() - start.year) * 12 + (today.getMonth() - start.month)
}
