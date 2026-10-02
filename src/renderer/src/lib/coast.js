// Coast FIRE math. Everything is in today's dollars, grown at the real return
// ((1 + nominal) / (1 + inflation) - 1). Contributions land at the end of each year.

export const COAST_DEFAULTS = {
  currentAge: '32',
  retireAge: '65',
  invested: '150k',
  contribution: 'retirement + roth_ira',
  spending: 'needs + wants',
  swr: '4%',
  nominalReturn: '7%',
  inflation: '3%'
}

export const COAST_FIELDS = [
  { key: 'currentAge', label: 'Current age', hint: 'years' },
  { key: 'retireAge', label: 'Retire at', hint: 'age you want to stop working' },
  { key: 'invested', label: 'Invested today', hint: 'retirement + brokerage balances' },
  { key: 'contribution', label: 'Yearly contributions', hint: 'can reference sheet variables' },
  { key: 'spending', label: 'Spending in retirement', hint: 'per year, today’s dollars' },
  { key: 'swr', label: 'Withdrawal rate', hint: 'classic rule is 4%' },
  { key: 'nominalReturn', label: 'Expected return', hint: 'before inflation' },
  { key: 'inflation', label: 'Inflation', hint: 'long-run average' }
]

const MAX_AGE = 100

export function coastProjection({ currentAge, retireAge, invested, contribution, spending, swr, nominalReturn, inflation }) {
  const r = (1 + nominalReturn) / (1 + inflation) - 1
  const fireNumber = spending / swr
  const years = Math.max(0, retireAge - currentAge)
  const coastNumber = fireNumber / (1 + r) ** years
  const targetAt = (age) => fireNumber / (1 + r) ** Math.max(0, retireAge - age)

  // Keep contributing every year.
  let balance = invested
  let coastAge = null
  let fiAge = null
  const series = []
  for (let age = currentAge; age <= MAX_AGE; age++) {
    if (coastAge === null && balance >= targetAt(age)) coastAge = age
    if (fiAge === null && balance >= fireNumber) fiAge = age
    series.push({ age, balance })
    if (age >= Math.max(retireAge, fiAge ?? Infinity) && coastAge !== null) break
    balance = balance * (1 + r) + contribution
  }

  // Stop contributing today and let it grow.
  let coastOnly = invested
  for (const point of series) {
    point.coastOnly = coastOnly
    point.target = point.age <= retireAge ? targetAt(point.age) : fireNumber
    coastOnly *= 1 + r
  }

  const atRetire = series.find((p) => p.age === retireAge)
  return {
    realReturn: r,
    fireNumber,
    coastNumber,
    progress: coastNumber > 0 ? invested / coastNumber : 0,
    coastAge,
    fiAge,
    gap: Math.max(0, coastNumber - invested),
    retireBalance: atRetire?.balance ?? null,
    retireCoastOnly: atRetire?.coastOnly ?? null,
    series: series.filter((p) => p.age <= Math.max(retireAge, Math.min(fiAge ?? retireAge, retireAge + 10)))
  }
}
