import React, { useState, useEffect } from 'react';

export default function TaskModal({ task, project, onUpdate, onClose }) {
  const [text, setText] = useState(task.text || '');
  const [notes, setNotes] = useState(task.notes || '');
  const [dueDate, setDueDate] = useState(task.dueDate || '');

  const commit = () => {
    onUpdate({ text, notes, dueDate: dueDate || null });
    onClose();
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') commit(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [text, notes, dueDate]);

  return (
    <div className="task-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) commit(); }}>
      <div className="task-modal">
        <div className="task-modal-header">
          <span className="task-modal-project-tag">{project.name}</span>
          <button className="task-modal-close" onClick={commit}>×</button>
        </div>

        <input
          className="task-modal-title-input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Task title"
          autoFocus
        />

        <div className="task-modal-date-row">
          <span className="task-modal-label">Due date</span>
          <input
            type="date"
            className="task-modal-date-input"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>

        <div className="task-modal-notes-section">
          <span className="task-modal-label">Notes</span>
          <textarea
            className="task-modal-notes-input"
            placeholder="Add notes, details, or context…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div className="task-modal-footer">
          <button className="task-modal-save-btn" onClick={commit}>Save & Close</button>
        </div>
      </div>
    </div>
  );
}
