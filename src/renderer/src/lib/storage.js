// Storage facade. Inside Electron this talks to the main process, which reads
// and writes JSON files on disk. In a plain browser (`npm run web`) it falls
// back to localStorage so the UI can be developed without Electron.

const KEY = 'pocketbook:budgets'

function browserStore() {
  const readAll = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {}
    } catch {
      return {}
    }
  }
  const writeAll = (all) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(all))
    } catch {
      // Storage unavailable (private window); keep working in memory.
    }
  }
  return {
    async list() {
      return Object.entries(readAll()).map(([id, d]) => ({ id, name: d.name, updatedAt: d.updatedAt, createdAt: d.createdAt }))
    },
    async load(id) {
      return readAll()[id] ?? null
    },
    async save(id, doc) {
      const all = readAll()
      const updatedAt = new Date().toISOString()
      all[id] = { ...doc, updatedAt }
      writeAll(all)
      return updatedAt
    },
    async create(doc) {
      const all = readAll()
      const base = String(doc.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'budget'
      let id = base
      for (let n = 2; all[id]; n++) id = `${base}-${n}`
      const now = new Date().toISOString()
      all[id] = { ...doc, createdAt: now, updatedAt: now }
      writeAll(all)
      return id
    },
    async remove(id) {
      const all = readAll()
      delete all[id]
      writeAll(all)
    },
    async info() {
      return { dataDir: 'browser localStorage (dev preview)', browser: true }
    },
    async reveal() {},
    async chooseDataDir() {
      return null
    }
  }
}

export const store = typeof window !== 'undefined' && window.pocketbook ? window.pocketbook : browserStore()
