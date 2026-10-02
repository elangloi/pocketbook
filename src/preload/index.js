import { contextBridge, ipcRenderer } from 'electron'

const call = (name) => (...args) => ipcRenderer.invoke(`store:${name}`, ...args)

contextBridge.exposeInMainWorld('pocketbook', {
  list: call('list'),
  load: call('load'),
  save: call('save'),
  create: call('create'),
  remove: call('remove'),
  info: call('info'),
  reveal: call('reveal'),
  chooseDataDir: call('chooseDataDir')
})
