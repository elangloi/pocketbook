// Demo sheet with made-up numbers. Everything is annual; frequency words annualize.
export const DEMO_SHEET = `# Income
salary = 145k
bonus = 8% of salary

# Pre-tax deductions
health insurance = 210 monthly
dental = 18 monthly
hsa = 4,400

# Retirement
401k = 12% of salary   // employer match goes in Coast FIRE, not here

# Taxes
federal = fedtax(taxable - stddeduction)   // 2026 single brackets, an estimate
_md_taxable = mdtaxable(taxable)   // AGI − $3,350 std deduction − exemption
maryland = mdtax(_md_taxable)
county = 3.2% of _md_taxable   // Montgomery, PG, Howard, Baltimore Co./City
fica = fica(gross - pretax)

# Necessities @need 50%
rent = 2,350 monthly
utilities = 180 monthly
internet = 65 monthly
phone = 45 monthly
groceries = 140 weekly
transit = 127 monthly
renters insurance = 18 monthly
medical out of pocket = 1,200

# Savings goals @save 20%
emergency fund = 600 monthly
roth ira = 7,500
travel fund = 400 monthly
house down payment = 500 monthly

# Wants / flex @want 30%
dining out = 450 monthly
shopping = 300 monthly
hobbies = 200 monthly
fitness = 120 monthly
subscriptions = 60 monthly
gifts = 1,500

# Scratch
// nothing in here is counted — it's just math
takehome / 12
monthly leftover = leftover / 12
savings rate = (retirement + savings) as % of gross
needs as % of takehome
`

export function blankSheet() {
  return `# Income
salary =

# Pre-tax deductions

# Retirement

# Taxes

# Necessities @need 50%

# Savings goals @save 20%

# Wants / flex @want 30%
`
}
