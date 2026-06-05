const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { pathToFileURL } = require('url');

// ── Load .env ─────────────────────────────────────────────────────────────────
require('dotenv').config({ path: path.join(app.getAppPath(), '.env') });
if (!process.env.ANTHROPIC_API_KEY) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// ── Supabase data layer ───────────────────────────────────────────────────────
const db = require('./lib/db');
db.init(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ── Anthropic SDK ─────────────────────────────────────────────────────────────
let Anthropic;
try {
  const mod = require('@anthropic-ai/sdk');
  Anthropic = mod.default || mod;
} catch (e) {
  console.error('Failed to load Anthropic SDK:', e.message);
}

// ── Active workspace (session state — stays local) ────────────────────────────
// Which workspace is currently open is UI state, not data.
// We keep it in a small local file so it survives app restarts.
const activeWsPath = path.join(app.getPath('userData'), 'active-workspace.json');
let currentWsId = 'default';

function readActiveWsId() {
  try {
    if (fs.existsSync(activeWsPath)) {
      const parsed = JSON.parse(fs.readFileSync(activeWsPath, 'utf-8'));
      if (parsed && parsed.id) return parsed.id;
    }
  } catch (_) {}
  return 'default';
}

function writeActiveWsId(id) {
  fs.writeFileSync(activeWsPath, JSON.stringify({ id }, null, 2));
}

// ── Local data reader (used only for the one-time migration) ──────────────────
function readLocalJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {}
  return fallback;
}

function wsDataPath(type, wsId) {
  return path.join(app.getPath('userData'), `${type}_${wsId}.json`);
}

const DEFAULT_SETTINGS = {
  heroImage: null,
  userName:  'Saint',
  topics:    ['Vocals', 'EQ', 'Compression', 'Bass', 'Reverb', 'Mastering'],
};

function buildLocalMigrationData() {
  const workspaces = readLocalJson(
    path.join(app.getPath('userData'), 'workspaces.json'),
    [{ id: 'default', name: 'My workspace', mode: 'light', createdAt: new Date().toISOString() }],
  );

  const settingsMap = {};
  const projectsMap = {};
  const notesMap    = {};

  for (const ws of workspaces) {
    // settings: workspace-scoped file, falling back to legacy settings.json for 'default'
    const settingsPath = wsDataPath('settings', ws.id);
    const legacySettings = path.join(app.getPath('userData'), 'settings.json');
    settingsMap[ws.id] = readLocalJson(settingsPath, null)
      || (ws.id === 'default' ? readLocalJson(legacySettings, DEFAULT_SETTINGS) : DEFAULT_SETTINGS);

    // projects
    const projectsPath = wsDataPath('projects', ws.id);
    const legacyProjects = path.join(app.getPath('userData'), 'projects.json');
    projectsMap[ws.id] = readLocalJson(projectsPath, null)
      || (ws.id === 'default' ? readLocalJson(legacyProjects, []) : []);

    // notes
    const notesPath = wsDataPath('notes', ws.id);
    const legacyNotes = path.join(app.getPath('userData'), 'notes.json');
    notesMap[ws.id] = readLocalJson(notesPath, null)
      || (ws.id === 'default' ? readLocalJson(legacyNotes, []) : []);
  }

  return { workspaces, settingsMap, projectsMap, notesMap };
}

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow;

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
    try { await systemPreferences.askForMediaAccess('microphone'); } catch (_) {}
  }

  currentWsId = readActiveWsId();

  // ── One-time migration: local JSON → Supabase ─────────────────────────────
  try {
    const firstRun = await db.isFirstRun();
    if (firstRun) {
      const localData = buildLocalMigrationData();
      await db.migrateFromLocal(localData);
      // Make sure the active workspace ID exists in Supabase
      const wsList = await db.getWorkspaces();
      if (wsList.length > 0 && !wsList.find(w => w.id === currentWsId)) {
        currentWsId = wsList[0].id;
        writeActiveWsId(currentWsId);
      }
    }
  } catch (err) {
    console.error('[main] Migration error (non-fatal):', err.message);
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
    return 'data:image/png;base64,' + sources[0].thumbnail.toPNG().toString('base64');
  } catch (err) {
    console.error('Capture error:', err);
    return null;
  }
});

// ── IPC: Notes ────────────────────────────────────────────────────────────────
ipcMain.handle('get-notes',    async ()           => db.getNotes(currentWsId));
ipcMain.handle('save-note',    async (_, payload) => db.insertNote(currentWsId, payload));
ipcMain.handle('update-note',  async (_, { id, changes }) => db.updateNote(currentWsId, id, changes));
ipcMain.handle('delete-note',  async (_, id)      => db.deleteNote(currentWsId, id));

// ── IPC: Projects ─────────────────────────────────────────────────────────────
ipcMain.handle('get-projects',  async ()     => db.getProjects(currentWsId));
ipcMain.handle('save-projects', async (_, d) => db.saveProjects(currentWsId, d));

// ── IPC: Settings ─────────────────────────────────────────────────────────────
ipcMain.handle('get-settings',  async ()     => db.getSettings(currentWsId));
ipcMain.handle('save-settings', async (_, d) => db.saveSettings(currentWsId, d));

// ── IPC: ElevenLabs key ───────────────────────────────────────────────────────
ipcMain.handle('get-elevenlabs-key', () => process.env.ELEVENLABS_API_KEY || '');

// ── IPC: Native audio picker ──────────────────────────────────────────────────
ipcMain.handle('pick-audio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'aiff', 'aac', 'm4a', 'flac', 'ogg'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const srcPath  = result.filePaths[0];
  const ext      = path.extname(srcPath).toLowerCase();
  const name     = path.basename(srcPath, ext);
  const destName = `audio_${Date.now()}${ext}`;
  const destPath = path.join(app.getPath('userData'), destName);
  fs.copyFileSync(srcPath, destPath);
  return { url: pathToFileURL(destPath).href, name, ext: ext.slice(1) };
});

// ── IPC: Native image picker ──────────────────────────────────────────────────
ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const srcPath  = result.filePaths[0];
  const ext      = path.extname(srcPath);
  const destName = `img_${Date.now()}${ext}`;
  const destPath = path.join(app.getPath('userData'), destName);
  fs.copyFileSync(srcPath, destPath);
  return pathToFileURL(destPath).href;
});

// ── IPC: Workspaces ───────────────────────────────────────────────────────────
ipcMain.handle('get-workspaces',   async ()     => db.getWorkspaces());
ipcMain.handle('save-workspaces',  async (_, ws) => db.saveWorkspaces(ws));
ipcMain.handle('get-active-workspace', () => currentWsId);

ipcMain.handle('set-active-workspace', (_, id) => {
  currentWsId = id;
  writeActiveWsId(id);
  return id;
});

ipcMain.handle('delete-workspace-data', async (_, wsId) => {
  await db.deleteWorkspaceData(wsId);
  return true;
});

// ── IPC: Chat (streaming) ─────────────────────────────────────────────────────
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
    stream.on('text', text => {
      if (!event.sender.isDestroyed()) event.sender.send('message-chunk', { text, done: false });
    });
    stream.on('error', err => {
      if (!event.sender.isDestroyed()) event.sender.send('message-chunk', { text: '', done: true, error: err.message });
    });
    await stream.finalMessage();
    if (!event.sender.isDestroyed()) event.sender.send('message-chunk', { text: '', done: true });
  } catch (err) {
    if (!event.sender.isDestroyed()) event.sender.send('message-chunk', { text: '', done: true, error: err.message });
  }
});
