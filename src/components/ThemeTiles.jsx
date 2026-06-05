import React from 'react';

export default function ThemeTiles({ value, onChange }) {
  return (
    <div className="ws-mode-tiles">
      {['light', 'dark'].map(m => (
        <button
          key={m}
          type="button"
          className={`ws-mode-tile${value === m ? ' active' : ''}`}
          onClick={() => onChange(m)}
        >
          <div className={`ws-mode-preview ws-preview-${m}`}>
            <div className="ws-prev-nav" />
            <div className="ws-prev-card" />
            <div className="ws-prev-card" />
          </div>
          <span className="ws-mode-label">{m === 'light' ? 'Light' : 'Dark'}</span>
        </button>
      ))}
    </div>
  );
}
