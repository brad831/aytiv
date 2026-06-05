import React, { useState } from 'react';
import ThemeTiles from './ThemeTiles';

export default function WorkspaceModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('light');

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, mode);
  };

  return (
    <div className="task-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="task-modal ws-create-modal">
        <div className="task-modal-header">
          <span style={{ fontSize: 15, fontWeight: 700 }}>New workspace</span>
          <button className="task-modal-close" onClick={onClose}>×</button>
        </div>

        <div>
          <div className="ws-modal-label">Name</div>
          <input
            className="ws-modal-name-input"
            placeholder="e.g. Album 2 Mixes"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>

        <div>
          <div className="ws-modal-label">Appearance</div>
          <ThemeTiles value={mode} onChange={setMode} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="pv-inline-add-btn secondary" onClick={onClose}>Cancel</button>
          <button className="pv-inline-add-btn" onClick={handleCreate} disabled={!name.trim()}>
            Create workspace
          </button>
        </div>
      </div>
    </div>
  );
}
