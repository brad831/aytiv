/**
 * scripts/migrate.js
 * Run once to copy all local JSON data into Supabase.
 *
 * Usage:
 *   cd ~/projects/copilot
 *   node scripts/migrate.js
 *
 * Safe to re-run — uses upsert, so nothing gets duplicated.
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');

// Load env from project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../lib/db');
db.init(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// On macOS the Electron userData folder is ~/Library/Application Support/<appName>
const USER_DATA = path.join(os.homedir(), 'Library', 'Application Support', 'copilot');

const DEFAULT_SETTINGS = {
  heroImage: null,
  userName:  'Saint',
  topics:    ['Vocals', 'EQ', 'Compression', 'Bass', 'Reverb', 'Mastering'],
};

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.warn(`  ⚠ Could not read ${filePath}: ${e.message}`);
  }
  return fallback;
}

function wsDataPath(type, wsId) {
  return path.join(USER_DATA, `${type}_${wsId}.json`);
}

async function run() {
  console.log('\n🚀  Copilot → Supabase migration\n');

  // 1. Load workspaces
  const workspaces = readJson(
    path.join(USER_DATA, 'workspaces.json'),
    [{ id: 'default', name: 'My workspace', mode: 'light', createdAt: new Date().toISOString() }],
  );
  console.log(`Found ${workspaces.length} workspace(s): ${workspaces.map(w => w.name).join(', ')}\n`);

  for (const ws of workspaces) {
    console.log(`── Workspace: "${ws.name}" (${ws.id})`);

    // 2. Settings — workspace-scoped file, fall back to legacy settings.json for 'default'
    const settings =
      readJson(wsDataPath('settings', ws.id), null) ||
      (ws.id === 'default'
        ? readJson(path.join(USER_DATA, 'settings.json'), DEFAULT_SETTINGS)
        : DEFAULT_SETTINGS);

    // 3. Projects — same fallback pattern
    const projects =
      readJson(wsDataPath('projects', ws.id), null) ||
      (ws.id === 'default'
        ? readJson(path.join(USER_DATA, 'projects.json'), [])
        : []);

    // 4. Notes
    const notes =
      readJson(wsDataPath('notes', ws.id), null) ||
      (ws.id === 'default'
        ? readJson(path.join(USER_DATA, 'notes.json'), [])
        : []);

    console.log(`   settings: ${Object.keys(settings).join(', ')}`);
    console.log(`   projects: ${projects.length}`);
    console.log(`   notes:    ${notes.length}`);
    console.log(`   topics:   ${(settings.topics || []).join(', ')}`);

    // 5. Run migration for this workspace
    await db.migrateFromLocal({
      workspaces: [ws],
      settingsMap: { [ws.id]: settings },
      projectsMap: { [ws.id]: projects },
      notesMap:    { [ws.id]: notes },
    });

    console.log(`   ✓ done\n`);
  }

  // 6. Verify
  console.log('── Verifying Supabase contents…');
  const sbWorkspaces = await db.getWorkspaces();
  console.log(`   workspaces: ${sbWorkspaces.length} (${sbWorkspaces.map(w => w.name).join(', ')})`);

  for (const w of sbWorkspaces) {
    const projects = await db.getProjects(w.id);
    const notes    = await db.getNotes(w.id);
    const settings = await db.getSettings(w.id);
    console.log(`   [${w.name}] projects: ${projects.length}, notes: ${notes.length}, topics: ${settings.topics.length}`);
  }

  console.log('\n✅  Migration complete! Launch the app via the desktop shortcut.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌  Migration failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
