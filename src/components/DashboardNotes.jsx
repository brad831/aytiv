import React, { useState, useEffect } from 'react';

function getText(n) {
  if (typeof n.text === 'string') return n.text;
  if (Array.isArray(n.text)) return n.text.find(b => b.type === 'text')?.text || '';
  return '';
}

function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Returns { title, body } for display. If note has an explicit title, body = full text.
// Otherwise, first sentence becomes title and the rest is body.
function splitNoteTitle(n) {
  const body = getText(n);
  if (n.title?.trim()) return { title: n.title.trim(), body };
  const idx = body.search(/[.!?\n]/);
  if (idx > 0 && idx < 120) {
    return { title: body.slice(0, idx + 1).trim(), body: body.slice(idx + 1).trim() };
  }
  return { title: body.slice(0, 80).trim(), body: body.slice(80).trim() };
}

export default function DashboardNotes({
  notes, topics, projects, onNavigate, onDeleteNote, onAddTopic,
  onSaveNote, onSelectNote, onUpdateNote,
}) {
  const [activeTopic, setActiveTopic] = useState(null);
  const [editingTopicFor, setEditingTopicFor] = useState(null);

  // New topic inline state
  const [addingTopic, setAddingTopic] = useState(false);
  const [newTopicText, setNewTopicText] = useState('');

  // New note modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteProject, setNoteProject] = useState('');

  const filtered = activeTopic ? notes.filter(n => n.topic === activeTopic) : notes;

  const handleTopicConfirm = () => {
    if (newTopicText.trim()) onAddTopic(newTopicText.trim());
    setNewTopicText('');
    setAddingTopic(false);
  };

  const handlePickTopic = (e, noteId, topic) => {
    e.stopPropagation();
    onUpdateNote?.(noteId, { topic });
    setEditingTopicFor(null);
  };

  const openNoteModal = () => {
    setNoteTitle('');
    setNoteText('');
    setNoteTopic('');
    setNoteProject('');
    setNoteModalOpen(true);
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    onSaveNote?.({
      title: noteTitle.trim() || null,
      text: noteText.trim(),
      topic: noteTopic || null,
      projectId: noteProject || null,
    });
    setNoteModalOpen(false);
  };

  useEffect(() => {
    if (!noteModalOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setNoteModalOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [noteModalOpen]);

  return (
    <div className="dashboard-notes">
      <div className="dashboard-notes-header">
        <span className="dashboard-notes-title">Notes</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="notes-new-btn" onClick={openNoteModal}>+ New note</button>
          <button className="notes-view-all" onClick={() => onNavigate('notes')}>View all</button>
        </div>
      </div>

      <div className="topic-pills">
        <button className={`topic-pill${activeTopic === null ? ' active' : ''}`} onClick={() => setActiveTopic(null)}>All</button>
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
          <button className="topic-pill new-topic" onClick={e => { e.stopPropagation(); setAddingTopic(true); }}>+ New topic</button>
        )}
      </div>

      <div className="notes-list">
        {filtered.length === 0 && <div className="notes-empty">No notes yet</div>}
        {filtered.slice(0, 5).map(n => {
          const { title, body } = splitNoteTitle(n);
          return (
            <div key={n.id}>
              <div className="note-item" onClick={() => onSelectNote?.(n.id)}>
                <div className="note-display-title">{title}</div>
                {body && <div className="note-display-body">{body.slice(0, 100)}</div>}
                <div className="note-meta">
                  <button
                    className={`note-tag-editable${n.topic ? '' : ' note-tag-empty'}`}
                    title="Change topic"
                    onClick={e => { e.stopPropagation(); setEditingTopicFor(prev => prev === n.id ? null : n.id); }}
                  >
                    {n.topic || '+ Topic'}
                  </button>
                  <span className="note-date">{fmtDate(n.savedAt)}</span>
                  <button className="note-delete" onClick={e => { e.stopPropagation(); onDeleteNote(n.id); }} title="Delete">×</button>
                </div>
              </div>
              {editingTopicFor === n.id && (
                <div className="note-topic-picker" onClick={e => e.stopPropagation()}>
                  {topics.map(t => (
                    <button key={t} className={`topic-picker-chip${n.topic === t ? ' active' : ''}`}
                      onClick={e => handlePickTopic(e, n.id, t)}>{t}</button>
                  ))}
                  <button className="topic-picker-chip" onClick={e => handlePickTopic(e, n.id, null)}>None</button>
                  <button className="topic-picker-chip" onClick={e => { e.stopPropagation(); setEditingTopicFor(null); }}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── New note modal ── */}
      {noteModalOpen && (
        <div className="task-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setNoteModalOpen(false); }}>
          <div className="task-modal">
            <div className="task-modal-header">
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>New Note</span>
              <button className="task-modal-close" onClick={() => setNoteModalOpen(false)}>×</button>
            </div>

            <input
              className="note-title-input"
              placeholder="Title (optional)"
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
              autoFocus
            />

            <textarea
              className="task-modal-notes-input"
              placeholder="Write your note…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              style={{ minHeight: 120 }}
            />

            <div className="note-modal-selectors">
              <div className="note-modal-field">
                <span className="task-modal-label">Topic</span>
                <select className="note-modal-select" value={noteTopic} onChange={e => setNoteTopic(e.target.value)}>
                  <option value="">No topic</option>
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="note-modal-field">
                <span className="task-modal-label">Project</span>
                <select className="note-modal-select" value={noteProject} onChange={e => setNoteProject(e.target.value)}>
                  <option value="">No project</option>
                  {(projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="task-modal-footer">
              <button className="task-modal-save-btn" onClick={handleSaveNote} disabled={!noteText.trim()}>Save note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
