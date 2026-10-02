// Electron main process: window + a tiny file-backed store.
//
// Each budget is one JSON file in the data folder (default:
// ~/Library/Application Support/Pocketbook/budgets). Writes are atomic
// (write temp file, then rename) and the previous version is copied to
// .backups/ once per day so a bad edit is always recoverable.

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join, basename } from 'node:path'
import fs from 'node:fs/promises'

app.setName('Pocketbook')
app.setPath('userData', join(app.getPath('appData'), 'Pocketbook'))

const SETTINGS_FILE = join(app.getPath('userData'), 'settings.json')
const DEFAULT_DATA_DIR = join(app.getPath('userData'), 'budgets')
const EXT = '.pocketbook.json'

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

async function getSettings() {
  return readJson(SETTINGS_FILE, {})
}

async function dataDir() {
  const dir = (await getSettings()).dataDir || DEFAULT_DATA_DIR
  await fs.mkdir(dir, { recursive: true })
  return dir
}

function safeId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`Bad budget id: ${id}`)
  return id
}

const fileFor = async (id) => join(await dataDir(), safeId(id) + EXT)

async function uniqueId(name) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'budget'
  const dir = await dataDir()
  const existing = new Set((await fs.readdir(dir)).filter((f) => f.endsWith(EXT)).map((f) => f.slice(0, -EXT.length)))
  let id = base
  for (let n = 2; existing.has(id); n++) id = `${base}-${n}`
  return id
}

async function backup(file, id) {
  try {
    const dir = join(await dataDir(), '.backups')
    await fs.mkdir(dir, { recursive: true })
    const target = join(dir, `${id}-${new Date().toISOString().slice(0, 10)}${EXT}`)
    await fs.access(target).then(
      () => {},
      () => fs.copyFile(file, target)
    )
  } catch {
    // No existing file yet, nothing to back up.
  }
}

const handlers = {
  async list() {
    const dir = await dataDir()
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(EXT))
    const budgets = await Promise.all(
      files.map(async (f) => {
        const doc = await readJson(join(dir, f), null)
        if (!doc) return null
        return { id: basename(f, EXT), name: doc.name, updatedAt: doc.updatedAt, createdAt: doc.createdAt }
      })
    )
    return budgets.filter(Boolean)
  },

  async load(id) {
    return readJson(await fileFor(id), null)
  },

  async save(id, doc) {
    const file = await fileFor(id)
    await backup(file, id)
    const saved = { ...doc, updatedAt: new Date().toISOString() }
    await writeJsonAtomic(file, saved)
    return saved.updatedAt
  },

  async create(doc) {
    const id = await uniqueId(doc.name)
    const now = new Date().toISOString()
    await writeJsonAtomic(await fileFor(id), { ...doc, createdAt: now, updatedAt: now })
    return id
  },

  // Moves to the macOS Trash rather than deleting, so it can be restored.
  async remove(id) {
    await shell.trashItem(await fileFor(id))
  },

  async info() {
    return { dataDir: await dataDir(), defaultDataDir: DEFAULT_DATA_DIR }
  },

  async reveal() {
    await shell.openPath(await dataDir())
  },

  async chooseDataDir() {
    const result = await dialog.showOpenDialog({
      title: 'Choose where Pocketbook keeps your budgets',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: await dataDir()
    })
    if (result.canceled || !result.filePaths[0]) return null
    const settings = await getSettings()
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await writeJsonAtomic(SETTINGS_FILE, { ...settings, dataDir: result.filePaths[0] })
    return result.filePaths[0]
  }
}

for (const [name, fn] of Object.entries(handlers)) {
  ipcMain.handle(`store:${name}`, (_event, ...args) => fn(...args))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    title: 'Pocketbook',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#050507',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win.show())

  // Links open in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
