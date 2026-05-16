import React, { useState } from 'react';

function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function getText(n) {
  if (typeof n.text === 'string') return n.text;
  if (Array.isArray(n.text)) return n.text.find(b => b.type === 'text')?.text || '';
  return '';
}
function splitNoteTitle(n) {
  const body = getText(n);
  if (n.title?.trim()) return { title: n.title.trim(), body };
  const idx = body.search(/[.!?\n]/);
  if (idx > 0 && idx < 120) {
    return { title: body.slice(0, idx + 1).trim(), body: body.slice(idx + 1).trim() };
  }
  return { title: body.slice(0, 80).trim(), body: body.slice(80).trim() };
}

export default function NotesScreen({
  notes, topics, projects, onDeleteNote, onAddTopic, onUpdateNote, onSaveNote, highlightNoteId,
}) {
  const [activeTopic, setActiveTopic]         = useState(null);
  const [activeProject, setActiveProject]     = useState(null);
  const [editingTopicFor, setEditingTopicFor] = useState(null);

  // New topic inline state
  const [addingTopic, setAddingTopic]   = useState(false);
  const [newTopicText, setNewTopicText] = useState('');

  // New note form state
  const [showNewNote, setShowNewNote]           = useState(false);
  const [newNoteTitle, setNewNoteTitle]         = useState('');
  const [newNoteText, setNewNoteText]           = useState('');
  const [newNoteTopic, setNewNoteTopic]         = useState('');
  const [newNoteProjectId, setNewNoteProjectId] = useState('');

  const filtered = notes.filter(n => {
    if (activeTopic && n.topic !== activeTopic) return false;
    if (activeProject && n.projectId !== activeProject) return false;
    return true;
  });

  const handleTopicConfirm = () => {
    if (newTopicText.trim()) onAddTopic(newTopicText.trim());
    setNewTopicText('');
    setAddingTopic(false);
  };

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) return;
    await onSaveNote({
      title: newNoteTitle.trim() || null,
      text: newNoteText.trim(),
      topic: newNoteTopic || null,
      projectId: newNoteProjectId || null,
    });
    setNewNoteTitle('');
    setNewNoteText('');
    setNewNoteTopic('');
    setNewNoteProjectId('');
    setShowNewNote(false);
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="screen-title">Notes</h1>
        <button className="btn-new-note" onClick={() => setShowNewNote(v => !v)}>
          {showNewNote ? 'Cancel' : '+ New note'}
        </button>
      </div>
      <p className="screen-sub">{notes.length} note{notes.length !== 1 ? 's' : ''} saved</p>

      {showNewNote && (
        <div className="new-note-form">
          <input
            className="note-title-input"
            placeholder="Title (optional)"
            value={newNoteTitle}
            onChange={e => setNewNoteTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="new-note-textarea"
            placeholder="Write your note…"
            value={newNoteText}
            onChange={e => setNewNoteText(e.target.value)}
          />
          <div className="new-note-row">
            <select className="new-note-select" value={newNoteTopic} onChange={e => setNewNoteTopic(e.target.value)}>
              <option value="">No topic</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {projects.length > 0 && (
              <select className="new-note-select" value={newNoteProjectId} onChange={e => setNewNoteProjectId(e.target.value)}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button className="new-note-save-btn" disabled={!newNoteText.trim()} onClick={handleCreateNote}>
              Save note
            </button>
          </div>
        </div>
      )}

      <div className="notes-filters">
        <button className={`topic-pill${activeTopic === null ? ' active' : ''}`} onClick={() => setActiveTopic(null)}>All topics</button>
        {topics.map(t => (
          <button key={t} className={`topic-pill${activeTopic === t ? ' active' : ''}`}
            onClick={() => setActiveTopic(prev => prev === t ? null : t)}>{t}</button>
        ))}
        {addingTopic ? (
          <div className="new-topic-inline">
            <input
              className="new-topic-input"
              value={newTopicText}
              onChange={e => setNewTopicText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleTopicConfirm();
                if (e.key === 'Escape') { setAddingTopic(false); setNewTopicText(''); }
              }}
              placeholder="Topic name…"
              autoFocus
            />
            <button className="new-topic-confirm" onClick={handleTopicConfirm}>Add</button>
            <button className="new-topic-cancel" onClick={() => { setAddingTopic(false); setNewTopicText(''); }}>×</button>
          </div>
        ) : (
          <button className="topic-pill new-topic" onClick={() => setAddingTopic(true)}>+ New topic</button>
        )}
      </div>

      {projects.length > 0 && (
        <div className="notes-filters" style={{ marginBottom: 20 }}>
          <button className={`topic-pill${activeProject === null ? ' active' : ''}`} onClick={() => setActiveProject(null)}>All projects</button>
          {projects.map(p => (
            <button key={p.id} className={`topic-pill${activeProject === p.id ? ' active' : ''}`}
              onClick={() => setActiveProject(prev => prev === p.id ? null : p.id)}>{p.name}</button>
          ))}
        </div>
      )}

      <div className="notes-full-list">
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No notes found</div>
        )}
        {filtered.map(n => {
          const proj = projects.find(p => p.id === n.projectId);
          const isHighlighted = n.id === highlightNoteId;
          const { title, body } = splitNoteTitle(n);
          return (
            <div key={n.id} className="note-full-card"
              style={isHighlighted ? { borderColor: 'var(--status-in_progress)', boxShadow: '0 0 0 2px rgba(55,138,221,.2)' } : {}}>
              <div className="note-full-title">{title}</div>
              {body && <div className="note-full-body">{body}</div>}
              <div className="note-full-meta">
                <button
                  className={`note-tag-editable${n.topic ? '' : ' note-tag-empty'}`}
                  title="Change topic"
                  onClick={() => setEditingTopicFor(prev => prev === n.id ? null : n.id)}
                >
                  {n.topic || '+ Topic'}
                </button>
                {proj && <span className="note-tag" style={{ borderColor: 'var(--border2)' }}>{proj.name}</span>}
                <span className="note-date" style={{ flex: 1, fontSize: 11 }}>{fmtDate(n.savedAt)}</span>
                <button className="note-delete" onClick={() => onDeleteNote(n.id)} title="Delete">×</button>
              </div>
              {editingTopicFor === n.id && (
                <div className="note-topic-picker">
                  {topics.map(t => (
                    <button key={t} className={`topic-picker-chip${n.topic === t ? ' active' : ''}`}
                      onClick={() => { onUpdateNote?.(n.id, { topic: t }); setEditingTopicFor(null); }}>{t}</button>
                  ))}
                  <button className="topic-picker-chip" onClick={() => { onUpdateNote?.(n.id, { topic: null }); setEditingTopicFor(null); }}>None</button>
                  <button className="topic-picker-chip" onClick={() => setEditingTopicFor(null)}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
