import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { store } from './lib/storage.js'
import { evaluateSheet } from './lib/calc.js'
import { DEMO_SHEET, blankSheet } from './lib/template.js'
import SheetView from './views/SheetView.jsx'
import FlowView from './views/FlowView.jsx'
import BreakdownView from './views/BreakdownView.jsx'
import CoastView from './views/CoastView.jsx'
import MortgageView from './views/MortgageView.jsx'

const TABS = [
  { id: 'sheet', label: 'Sheet' },
  { id: 'flow', label: 'Cash flow' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'coast', label: 'Coast FIRE' },
  { id: 'mortgage', label: 'Mortgage' }
]

const LAST_KEY = 'pocketbook:last'
const remember = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {}
}
const recall = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const newDoc = (name, sheet, coast = {}) => ({ version: 1, name, sheet, coast })

// Ambient backdrop: smoky monochrome clouds plus slow aurora light from below.
function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <svg className="clouds" preserveAspectRatio="none">
        <filter id="cloud-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.009" numOctaves="5" seed="7" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.25 -0.45" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cloud-noise)" />
      </svg>
      <span className="a1" />
      <span className="a2" />
      <span className="a3" />
      <span className="a4" />
      <span className="a5" />
    </div>
  )
}

export default function App() {
  const [budgets, setBudgets] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [doc, setDoc] = useState(null)
  const [tab, setTab] = useState(recall('pocketbook:tab') || 'sheet')
  const [saveState, setSaveState] = useState('saved')
  const [info, setInfo] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const dirty = useRef(false)
  const booted = useRef(false)

  const refresh = useCallback(async () => {
    const list = await store.list()
    list.sort((a, b) => String(b.name).localeCompare(String(a.name), undefined, { numeric: true }))
    setBudgets(list)
    return list
  }, [])

  const open = useCallback(async (id) => {
    const loaded = await store.load(id)
    if (!loaded) return
    dirty.current = false
    setDoc(loaded)
    setCurrentId(id)
    setSaveState('saved')
    remember(LAST_KEY, id)
  }, [])

  // First launch: seed a demo budget for this year.
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    ;(async () => {
      setInfo(await store.info())
      let list = await refresh()
      if (list.length === 0) {
        const year = new Date().getFullYear()
        await store.create(newDoc(`${year} demo`, DEMO_SHEET))
        list = await refresh()
      }
      const last = recall(LAST_KEY)
      await open(list.find((b) => b.id === last)?.id ?? list[0].id)
    })()
  }, [refresh, open])

  // Debounced autosave to disk.
  useEffect(() => {
    if (!doc || !currentId || !dirty.current) return
    setSaveState('saving')
    const t = setTimeout(async () => {
      try {
        await store.save(currentId, doc)
        dirty.current = false
        setSaveState('saved')
        setBudgets((list) => list.map((b) => (b.id === currentId ? { ...b, name: doc.name } : b)))
      } catch (e) {
        console.error(e)
        setSaveState('error')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [doc, currentId])

  const update = useCallback((next) => {
    dirty.current = true
    setDoc(next)
  }, [])

  const evaluation = useMemo(() => evaluateSheet(doc?.sheet ?? ''), [doc?.sheet])

  const selectTab = (id) => {
    setTab(id)
    remember('pocketbook:tab', id)
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && /^[1-5]$/.test(e.key)) {
        e.preventDefault()
        selectTab(TABS[Number(e.key) - 1].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const create = async (kind) => {
    setMenuOpen(false)
    const year = new Date().getFullYear()
    const taken = new Set(budgets.map((b) => b.name))
    let name = kind === 'duplicate' ? `${doc.name} copy` : String(year)
    if (kind === 'duplicate' && /^\d{4}$/.test(doc.name)) name = String(Number(doc.name) + 1)
    for (let n = 2; taken.has(name); n++) name = `${kind === 'duplicate' ? doc.name + ' copy' : year} ${n}`
    const fresh =
      kind === 'duplicate' ? newDoc(name, doc.sheet, doc.coast) : kind === 'demo' ? newDoc(name, DEMO_SHEET) : newDoc(name, blankSheet())
    const id = await store.create(fresh)
    await refresh()
    await open(id)
    selectTab('sheet')
  }

  const remove = async () => {
    if (!window.confirm(`Move “${doc.name}” to the Trash?`)) return
    await store.remove(currentId)
    const list = await refresh()
    if (list.length) await open(list[0].id)
    else {
      const id = await store.create(newDoc(String(new Date().getFullYear()), blankSheet()))
      await refresh()
      await open(id)
    }
  }

  return (
    <div className="app">
      <Aurora />
      <aside className="sidebar">
        <div className="drag-region" />
        <div className="brand">Pocketbook</div>
        <div className="sidebar-section">
          <div className="sidebar-heading">
            Budgets
            <div className="menu-wrap">
              <button className="icon-button" aria-label="New budget" onClick={() => setMenuOpen((o) => !o)}>+</button>
              {menuOpen && (
                <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
                  <button onClick={() => create('duplicate')} disabled={!doc}>Duplicate current{/^\d{4}$/.test(doc?.name ?? '') ? ` as ${Number(doc.name) + 1}` : ''}</button>
                  <button onClick={() => create('blank')}>New blank budget</button>
                  <button onClick={() => create('demo')}>New from demo</button>
                </div>
              )}
            </div>
          </div>
          <nav className="budget-list">
            {budgets.map((b) => (
              <button key={b.id} className={b.id === currentId ? 'is-active' : ''} onClick={() => open(b.id)}>
                {b.name}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-foot">
          <div className={`save-state save-${saveState}`}>
            <span className="dot" />
            {saveState === 'saved' ? 'Saved to disk' : saveState === 'saving' ? 'Saving…' : 'Could not save'}
          </div>
          {info && (
            <>
              <div className="data-dir" title={info.dataDir}>{info.dataDir.replace(/^\/Users\/[^/]+/, '~')}</div>
              {!info.browser && (
                <div className="foot-actions">
                  <button className="link-button" onClick={() => store.reveal()}>Show in Finder</button>
                  <button
                    className="link-button"
                    onClick={async () => {
                      const dir = await store.chooseDataDir()
                      if (dir) window.location.reload()
                    }}
                  >
                    Change folder
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          {doc && (
            <input
              className="title-input"
              value={doc.name}
              onChange={(e) => update({ ...doc, name: e.target.value })}
              aria-label="Budget name"
            />
          )}
          <nav className="tabs" role="tablist">
            {TABS.map((t, i) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => selectTab(t.id)} title={`⌘${i + 1}`}>
                {t.label}
              </button>
            ))}
          </nav>
          {doc && <button className="icon-button danger" onClick={remove} title="Move budget to Trash" aria-label="Move budget to Trash">⌫</button>}
        </header>
        <div className="content" key={tab}>
          {doc && tab === 'sheet' && <SheetView doc={doc} evaluation={evaluation} onChange={update} />}
          {doc && tab === 'flow' && <FlowView evaluation={evaluation} />}
          {doc && tab === 'breakdown' && <BreakdownView evaluation={evaluation} />}
          {doc && tab === 'coast' && <CoastView doc={doc} evaluation={evaluation} onChange={update} />}
          {doc && tab === 'mortgage' && <MortgageView doc={doc} evaluation={evaluation} onChange={update} />}
        </div>
      </main>
    </div>
  )
}
