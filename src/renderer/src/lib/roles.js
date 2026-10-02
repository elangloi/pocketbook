// Visual identity per budget role. Colors are CSS variables (see styles.css)
// so light and dark mode each get their own validated steps.
export const ROLE_COLOR = {
  income: 'var(--c-income)',
  pretax: 'var(--c-pretax)',
  retirement: 'var(--c-retirement)',
  tax: 'var(--c-tax)',
  need: 'var(--c-need)',
  save: 'var(--c-save)',
  want: 'var(--c-want)',
  leftover: 'var(--c-leftover)',
  shortfall: 'var(--c-critical)'
}

export const roleColor = (role) => ROLE_COLOR[role] ?? 'var(--c-neutral)'
