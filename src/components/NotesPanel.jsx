import React from 'react';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotesPanel({ notes, onDelete }) {
  return (
    <div className="notes-panel">
      <div className="notes-panel-header">
        <span>SAVED NOTES</span>
        <span className="notes-count">{notes.length}</span>
      </div>

      {notes.length === 0 ? (
        <div className="notes-empty">
          No notes yet. Click <strong>Save</strong> on any Copilot response to save it here.
        </div>
      ) : (
        <div className="notes-list">
          {notes.map(note => (
            <div key={note.id} className="note-card">
              <div className="note-text">
                {typeof note.text === 'string'
                  ? note.text
                  : JSON.stringify(note.text)}
              </div>
              <div className="note-footer">
                <span className="note-date">{formatDate(note.savedAt)}</span>
                <button
                  className="btn-delete-note"
                  onClick={() => onDelete(note.id)}
                  title="Delete note"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
