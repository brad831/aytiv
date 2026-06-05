/**
 * lib/db.js — Supabase data layer for Copilot
 *
 * All reads and writes go through this file. main.js calls these
 * functions from its IPC handlers. React components never change —
 * they receive the same data shapes they always did.
 *
 * Naming convention:
 *   - Supabase columns are snake_case  (mood_image, album_art …)
 *   - React / JS objects are camelCase (moodImage, albumArt …)
 *   - projectToDb / projectFromDb handle the mapping
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

let supabase = null;

// ── Init ──────────────────────────────────────────────────────────────────────
function init(url, key) {
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required in .env');
  }
  supabase = createClient(url, key, {
    auth:     { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });
  console.log('[db] Supabase client initialised →', url);
}

function client() {
  if (!supabase) throw new Error('[db] Call db.init() before using db functions');
  return supabase;
}

// ── Helpers: camelCase ↔ snake_case ──────────────────────────────────────────

function projectToDb(p, wsId) {
  return {
    id:                p.id,
    workspace_id:      wsId,
    name:              p.name,
    status:            p.status             || 'just_started',
    progress:          p.progress           || 0,
    mood_image:        p.moodImage          || null,
    album_art:         p.albumArt           || null,
    album_title:       p.albumTitle         || '',
    artist_name:       p.artistName         || '',
    mission_statement: p.missionStatement   || '',
    tracks:            p.tracks             || [],
    lyrics:            p.lyrics             || [],
    moodboard_images:  p.moodboardImages    || [],
    quick_asks:        p.quickAsks          || [],
    chat_history:      p.chatHistory        || [],
    created_at:        p.createdAt          || new Date().toISOString(),
    updated_at:        new Date().toISOString(),
  };
}

function projectFromDb(row, tasks) {
  return {
    id:               row.id,
    name:             row.name,
    status:           row.status,
    progress:         row.progress,
    moodImage:        row.mood_image        || null,
    albumArt:         row.album_art         || null,
    albumTitle:       row.album_title       || '',
    artistName:       row.artist_name       || '',
    missionStatement: row.mission_statement || '',
    tracks:           row.tracks            || [],
    lyrics:           row.lyrics            || [],
    moodboardImages:  row.moodboard_images  || [],
    quickAsks:        row.quick_asks        || [],
    chatHistory:      row.chat_history      || [],
    tasks:            (tasks || []).map(taskFromDb),
    createdAt:        row.created_at,
  };
}

function taskToDb(t, projectId, wsId, idx) {
  return {
    id:           t.id,
    project_id:   projectId,
    workspace_id: wsId,
    text:         t.text,
    done:         t.done         || false,
    due_date:     t.dueDate      || null,
    notes:        t.notes        || '',
    sort_order:   t.order != null ? t.order : idx,
    created_at:   t.createdAt    || new Date().toISOString(),
  };
}

function taskFromDb(row) {
  return {
    id:        row.id,
    text:      row.text,
    done:      row.done,
    dueDate:   row.due_date   || null,
    notes:     row.notes      || '',
    order:     row.sort_order || 0,
    createdAt: row.created_at,
  };
}

// ── Workspaces ────────────────────────────────────────────────────────────────

async function getWorkspaces() {
  const { data, error } = await client()
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) { console.error('[db] getWorkspaces:', error.message); return []; }

  return (data || []).map(row => ({
    id:        row.id,
    name:      row.name,
    mode:      row.mode || 'light',
    createdAt: row.created_at,
  }));
}

async function saveWorkspaces(workspaces) {
  if (!workspaces?.length) return workspaces;

  const rows = workspaces.map(w => ({
    id:         w.id,
    name:       w.name,
    mode:       w.mode || 'light',
    created_at: w.createdAt || new Date().toISOString(),
  }));

  const { error } = await client()
    .from('workspaces')
    .upsert(rows, { onConflict: 'id' });

  if (error) console.error('[db] saveWorkspaces:', error.message);

  // Delete workspaces that were removed
  const ids = workspaces.map(w => w.id);
  const { error: delErr } = await client()
    .from('workspaces')
    .delete()
    .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

  if (delErr) console.error('[db] saveWorkspaces (delete):', delErr.message);

  return workspaces;
}

async function deleteWorkspaceData(wsId) {
  // Cascade delete handles tasks, projects, notes, topics
  const { error } = await client()
    .from('workspaces')
    .delete()
    .eq('id', wsId);
  if (error) console.error('[db] deleteWorkspaceData:', error.message);
  return true;
}

// ── Projects ──────────────────────────────────────────────────────────────────

async function getProjects(wsId) {
  const [projResult, taskResult] = await Promise.all([
    client().from('projects').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
    client().from('tasks').select('*').eq('workspace_id', wsId).order('sort_order', { ascending: true }),
  ]);

  if (projResult.error) { console.error('[db] getProjects:', projResult.error.message); return []; }

  const projects = projResult.data || [];
  const tasks    = taskResult.data  || [];

  // Group tasks by project_id
  const tasksByProject = {};
  for (const t of tasks) {
    if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
    tasksByProject[t.project_id].push(t);
  }

  return projects.map(p => projectFromDb(p, tasksByProject[p.id] || []));
}

async function saveProjects(wsId, projects) {
  if (!projects?.length) {
    // Delete all projects for this workspace
    await client().from('projects').delete().eq('workspace_id', wsId);
    return projects;
  }

  // 1. Upsert all project rows
  const projectRows = projects.map(p => projectToDb(p, wsId));
  const { error: projErr } = await client()
    .from('projects')
    .upsert(projectRows, { onConflict: 'id' });
  if (projErr) console.error('[db] saveProjects (upsert):', projErr.message);

  // 2. Delete projects in DB that are no longer in the list
  const ids = projects.map(p => p.id);
  await client()
    .from('projects')
    .delete()
    .eq('workspace_id', wsId)
    .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

  // 3. Sync tasks — delete all tasks for this workspace then re-insert
  //    (simpler than diffing; task counts are small)
  await client().from('tasks').delete().eq('workspace_id', wsId);

  const taskRows = [];
  for (const p of projects) {
    for (let i = 0; i < (p.tasks || []).length; i++) {
      taskRows.push(taskToDb(p.tasks[i], p.id, wsId, i));
    }
  }
  if (taskRows.length > 0) {
    const { error: taskErr } = await client()
      .from('tasks')
      .upsert(taskRows, { onConflict: 'id' });
    if (taskErr) console.error('[db] saveProjects (tasks):', taskErr.message);
  }

  return projects;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

async function getNotes(wsId) {
  const { data, error } = await client()
    .from('notes')
    .select('*')
    .eq('workspace_id', wsId)
    .order('saved_at', { ascending: false });

  if (error) { console.error('[db] getNotes:', error.message); return []; }

  return (data || []).map(row => ({
    id:        row.id,
    text:      row.text,
    title:     row.title    || null,
    projectId: row.project_id || null,
    topic:     row.topic    || null,
    savedAt:   row.saved_at,
  }));
}

async function insertNote(wsId, payload) {
  const text      = typeof payload === 'string' ? payload : payload.text;
  const title     = typeof payload === 'object' ? (payload.title?.trim() || null) : null;
  const projectId = typeof payload === 'object' ? (payload.projectId ?? null) : null;
  const topic     = typeof payload === 'object' ? (payload.topic ?? null) : null;

  const { error } = await client().from('notes').insert({
    id:           String(Date.now()),
    workspace_id: wsId,
    project_id:   projectId,
    title,
    text:         text || '',
    topic,
    saved_at:     new Date().toISOString(),
  });
  if (error) console.error('[db] insertNote:', error.message);

  return getNotes(wsId);
}

async function updateNote(wsId, id, changes) {
  const update = {};
  if (changes.title !== undefined) update.title     = changes.title;
  if (changes.text  !== undefined) update.text      = changes.text;
  if (changes.topic !== undefined) update.topic     = changes.topic;

  const { error } = await client()
    .from('notes')
    .update(update)
    .eq('id', String(id));
  if (error) console.error('[db] updateNote:', error.message);

  return getNotes(wsId);
}

async function deleteNote(wsId, id) {
  const { error } = await client()
    .from('notes')
    .delete()
    .eq('id', String(id));
  if (error) console.error('[db] deleteNote:', error.message);

  return getNotes(wsId);
}

// ── Settings ──────────────────────────────────────────────────────────────────
// Settings live on the workspaces row as a JSONB column.
// Topics are normalized to their own table.

const DEFAULT_SETTINGS = {
  heroImage: null,
  userName:  'Saint',
  topics:    ['Vocals', 'EQ', 'Compression', 'Bass', 'Reverb', 'Mastering'],
};

async function getSettings(wsId) {
  const [wsResult, topicResult] = await Promise.all([
    client().from('workspaces').select('settings').eq('id', wsId).single(),
    client().from('topics').select('name, sort_order').eq('workspace_id', wsId).order('sort_order', { ascending: true }),
  ]);

  const stored = wsResult.data?.settings || {};
  const topics = topicResult.data
    ? topicResult.data.map(r => r.name)
    : DEFAULT_SETTINGS.topics;

  return {
    heroImage: stored.heroImage ?? DEFAULT_SETTINGS.heroImage,
    userName:  stored.userName  ?? DEFAULT_SETTINGS.userName,
    topics,
  };
}

async function saveSettings(wsId, settings) {
  // 1. Update workspace settings JSONB (everything except topics)
  const { error: wsErr } = await client()
    .from('workspaces')
    .update({ settings: { heroImage: settings.heroImage || null, userName: settings.userName || 'Saint' } })
    .eq('id', wsId);
  if (wsErr) console.error('[db] saveSettings (workspace):', wsErr.message);

  // 2. Sync topics — delete existing, re-insert
  await client().from('topics').delete().eq('workspace_id', wsId);

  const topics = (settings.topics || []).map((name, i) => ({
    id:           `topic_${wsId}_${i}_${name.toLowerCase().replace(/\s+/g, '_')}`,
    workspace_id: wsId,
    name,
    sort_order:   i,
  }));
  if (topics.length > 0) {
    const { error: topicErr } = await client()
      .from('topics')
      .upsert(topics, { onConflict: 'workspace_id, name' });
    if (topicErr) console.error('[db] saveSettings (topics):', topicErr.message);
  }

  return settings;
}

// ── Migration: local JSON files → Supabase ────────────────────────────────────
// Called once on first launch when Supabase has no workspaces.
// `localData` is an object built in main.js from the existing JSON files.

async function isFirstRun() {
  const { data } = await client()
    .from('workspaces')
    .select('id')
    .limit(1);
  return !data || data.length === 0;
}

async function migrateFromLocal(localData) {
  console.log('[db] First run — migrating local data to Supabase...');

  for (const ws of localData.workspaces) {
    console.log(`[db]   Migrating workspace: ${ws.name} (${ws.id})`);

    const settings = localData.settingsMap[ws.id] || DEFAULT_SETTINGS;
    const projects = localData.projectsMap[ws.id] || [];
    const notes    = localData.notesMap[ws.id]    || [];

    // 1. Upsert workspace
    const { error: wsErr } = await client().from('workspaces').upsert({
      id:         ws.id,
      name:       ws.name,
      mode:       ws.mode       || 'light',
      settings:   {
        heroImage: settings.heroImage || null,
        userName:  settings.userName  || 'Saint',
      },
      created_at: ws.createdAt  || new Date().toISOString(),
    });
    if (wsErr) { console.error('[db] migrate workspace:', wsErr.message); continue; }

    // 2. Topics
    const topics = (settings.topics || DEFAULT_SETTINGS.topics).map((name, i) => ({
      id:           `topic_${ws.id}_${i}`,
      workspace_id: ws.id,
      name,
      sort_order:   i,
    }));
    if (topics.length > 0) {
      const { error } = await client().from('topics').upsert(topics, { ignoreDuplicates: true });
      if (error) console.error('[db] migrate topics:', error.message);
    }

    // 3. Projects + tasks
    for (const p of projects) {
      const { error: pErr } = await client().from('projects').upsert(projectToDb(p, ws.id));
      if (pErr) { console.error('[db] migrate project:', pErr.message); continue; }

      const taskRows = (p.tasks || []).map((t, i) => taskToDb(t, p.id, ws.id, i));
      if (taskRows.length > 0) {
        const { error: tErr } = await client().from('tasks').upsert(taskRows, { onConflict: 'id' });
        if (tErr) console.error('[db] migrate tasks:', tErr.message);
      }
    }

    // 4. Notes
    const noteRows = notes.map(n => ({
      id:           String(n.id),
      workspace_id: ws.id,
      project_id:   n.projectId || null,
      title:        n.title     || null,
      text:         n.text      || '',
      topic:        n.topic     || null,
      saved_at:     n.savedAt   || new Date().toISOString(),
    }));
    if (noteRows.length > 0) {
      const { error: nErr } = await client().from('notes').upsert(noteRows, { onConflict: 'id' });
      if (nErr) console.error('[db] migrate notes:', nErr.message);
    }
  }

  console.log('[db] Migration complete.');
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  init,
  isFirstRun,
  migrateFromLocal,
  getWorkspaces,
  saveWorkspaces,
  deleteWorkspaceData,
  getProjects,
  saveProjects,
  getNotes,
  insertNote,
  updateNote,
  deleteNote,
  getSettings,
  saveSettings,
};
