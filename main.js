const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// app.getAppPath() is more reliable than __dirname in Electron (works in both
// dev via `npm start` and the packaged .app shortcut).
require('dotenv').config({ path: path.join(app.getAppPath(), '.env') });
if (!process.env.ANTHROPIC_API_KEY) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// Handle Anthropic SDK CJS import
let Anthropic;
try {
  const mod = require('@anthropic-ai/sdk');
  Anthropic = mod.default || mod;
} catch (e) {
  console.error('Failed to load Anthropic SDK:', e.message);
}

let mainWindow;
const notesPath    = path.join(app.getPath('userData'), 'notes.json');
const projectsPath = path.join(app.getPath('userData'), 'projects.json');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

const SYSTEM_PROMPT = `You are Copilot, a session engineer and mixing assistant sitting right next to the producer. You have deep knowledge of Ableton Live Suite and the Waves plugin suite.

How you communicate:
- Talk like a knowledgeable producer sitting next to them — direct, practical, never condescending
- Plain language always. If you use a technical term, immediately follow it with a one-sentence plain-English explanation in parentheses — for example: "add some compression (compression automatically turns down the louder parts of a sound so the overall level feels more controlled)"
- Be specific: name exact plugins, suggest real settings with numbers, point to specific tracks or devices you can see
- Keep it focused and actionable — no padding, no lecture

Your expertise:
- Ableton Live Suite: instruments, effects, MIDI/audio routing, session view, arrangement view, Max for Live, Wavetable, Drift, Meld, Analog, Sampler, Simpler, all native effects
- Waves plugins: SSL G-Master Buss Compressor, CLA-76, CLA-2A, Abbey Road plugins, API 550/560, Scheps Omni Channel, J37 Tape, Renaissance series, H-Reverb, H-Delay, Rbass, L2/L3, and the full Waves catalog
- Mixing: gain staging, EQ, compression, saturation, stereo imaging, FX chains, send/return routing
- Mastering basics: limiting, loudness, stereo width
- Sound design and synthesis
- Music theory as it applies to production decisions

When you can see a screenshot of the Ableton session, study it carefully — look at track names, device chains, clip arrangement, levels, routing, and any visible settings. Give specific, contextual advice about exactly what you see rather than generic tips.`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#f0f0ee',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    try {
      await systemPreferences.askForMediaAccess('microphone');
    } catch (e) {
      // Will be prompted by browser on first use
    }
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC: API key ──────────────────────────────────────────────────────────────
ipcMain.handle('get-api-key', () => process.env.ANTHROPIC_API_KEY || '');

// ── IPC: Screen capture ───────────────────────────────────────────────────────
ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (!sources.length) return null;
    const png = sources[0].thumbnail.toPNG();
    return 'data:image/png;base64,' + png.toString('base64');
  } catch (err) {
    console.error('Capture error:', err);
    return null;
  }
});

// ── IPC: Notes ────────────────────────────────────────────────────────────────
function readNotes() {
  try {
    if (fs.existsSync(notesPath)) return JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
  } catch (_) {}
  return [];
}

function writeNotes(notes) {
  fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2));
}

ipcMain.handle('get-notes', () => readNotes());

ipcMain.handle('update-note', (_, { id, changes }) => {
  const notes = readNotes().map(n => n.id === id ? { ...n, ...changes } : n);
  writeNotes(notes);
  return notes;
});

ipcMain.handle('save-note', (_, payload) => {
  const text      = typeof payload === 'string' ? payload : payload.text;
  const title     = typeof payload === 'object' ? (payload.title?.trim() || null) : null;
  const projectId = typeof payload === 'object' ? (payload.projectId ?? null) : null;
  const topic     = typeof payload === 'object' ? (payload.topic ?? null) : null;
  const notes = readNotes();
  notes.unshift({ id: Date.now(), text, title, projectId, topic, savedAt: new Date().toISOString() });
  writeNotes(notes);
  return notes;
});

// ── IPC: Projects ─────────────────────────────────────────────────────────────
function readProjects() {
  try { if (fs.existsSync(projectsPath)) return JSON.parse(fs.readFileSync(projectsPath, 'utf-8')); } catch (_) {}
  return [];
}
function writeProjects(d) { fs.writeFileSync(projectsPath, JSON.stringify(d, null, 2)); }

ipcMain.handle('get-projects', () => readProjects());
ipcMain.handle('save-projects', (_, d) => { writeProjects(d); return d; });

// ── IPC: Settings ─────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  heroImage: null,
  userName: 'Saint',
  topics: ['Vocals', 'EQ', 'Compression', 'Bass', 'Reverb', 'Mastering'],
};
function readSettings() {
  try { if (fs.existsSync(settingsPath)) return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch (_) {}
  return DEFAULT_SETTINGS;
}
function writeSettings(d) { fs.writeFileSync(settingsPath, JSON.stringify(d, null, 2)); }

ipcMain.handle('get-settings', () => readSettings());
ipcMain.handle('save-settings', (_, d) => { writeSettings(d); return d; });

ipcMain.handle('delete-note', (_, id) => {
  const notes = readNotes().filter(n => n.id !== id);
  writeNotes(notes);
  return notes;
});

// ── IPC: ElevenLabs key ───────────────────────────────────────────────────────
ipcMain.handle('get-elevenlabs-key', () => process.env.ELEVENLABS_API_KEY || '');

// ── IPC: Native audio picker ──────────────────────────────────────────────
ipcMain.handle('pick-audio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'aiff', 'aac', 'm4a', 'flac', 'ogg'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const srcPath = result.filePaths[0];
  const ext = path.extname(srcPath).toLowerCase();
  const name = path.basename(srcPath, ext);
  const destName = `audio_${Date.now()}${ext}`;
  const destPath = path.join(app.getPath('userData'), destName);
  fs.copyFileSync(srcPath, destPath);
  return { url: pathToFileURL(destPath).href, name, ext: ext.slice(1) };
});

// ── IPC: Native image picker ──────────────────────────────────────────────────
// Copies selected file into userData so the path is always accessible, then
// returns a file:// URL. Avoids IPC size limits from base64 and broken paths.
ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const srcPath = result.filePaths[0];
  const ext = path.extname(srcPath); // includes dot, e.g. '.jpg'
  const destName = `img_${Date.now()}${ext}`;
  const destPath = path.join(app.getPath('userData'), destName);
  fs.copyFileSync(srcPath, destPath);
  return pathToFileURL(destPath).href;
});

// ── IPC: Chat (streaming) ─────────────────────────────────────────────────────
ipcMain.on('send-message', async (event, { messages, apiKey }) => {
  if (!Anthropic) {
    event.sender.send('message-chunk', { text: '', done: true, error: 'Anthropic SDK failed to load.' });
    return;
  }

  try {
    const client = new Anthropic({ apiKey });

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    stream.on('text', (text) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('message-chunk', { text, done: false });
      }
    });

    stream.on('error', (err) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('message-chunk', { text: '', done: true, error: err.message });
      }
    });

    await stream.finalMessage();

    if (!event.sender.isDestroyed()) {
      event.sender.send('message-chunk', { text: '', done: true });
    }
  } catch (err) {
    if (!event.sender.isDestroyed()) {
      event.sender.send('message-chunk', { text: '', done: true, error: err.message });
    }
  }
});
