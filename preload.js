const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNote: (text) => ipcRenderer.invoke('save-note', text),
  deleteNote: (id) => ipcRenderer.invoke('delete-note', id),
  getElevenLabsKey: () => ipcRenderer.invoke('get-elevenlabs-key'),
  updateNote: (id, changes) => ipcRenderer.invoke('update-note', { id, changes }),
  pickImage: () => ipcRenderer.invoke('pick-image'),
  pickAudio: () => ipcRenderer.invoke('pick-audio'),
  getProjects:  ()  => ipcRenderer.invoke('get-projects'),
  saveProjects: (d) => ipcRenderer.invoke('save-projects', d),
  getSettings:  ()  => ipcRenderer.invoke('get-settings'),
  saveSettings: (d) => ipcRenderer.invoke('save-settings', d),
  sendMessage: (data) => ipcRenderer.send('send-message', data),
  onMessageChunk: (cb) => {
    ipcRenderer.on('message-chunk', (_, data) => cb(data));
  },
  removeMessageChunkListeners: () => {
    ipcRenderer.removeAllListeners('message-chunk');
  },
});
