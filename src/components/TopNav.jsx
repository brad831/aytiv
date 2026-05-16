import React, { useState, useEffect, useRef } from 'react';

const STATUS_COLORS = {
  active: '#639922', in_progress: '#378ADD',
  just_started: '#EF9F27', overdue: '#E24B4A',
  complete: '#639922', on_hold: '#9e9e9c',
};
const STATUS_LABELS = {
  active: 'Active', in_progress: 'In Progress',
  just_started: 'Just Started', overdue: 'Overdue',
  complete: 'Complete', on_hold: 'On Hold',
};
const STATUS_OPTIONS = [
  { value: 'just_started', label: 'Just Started' },
  { value: 'in_progress',  label: 'In Progress'  },
  { value: 'active',       label: 'Active'        },
  { value: 'complete',     label: 'Complete'      },
  { value: 'on_hold',      label: 'On Hold'       },
];

const LINKS = ['Dashboard', 'Projects', 'Notes', 'Settings'];

export default function TopNav({
  activeScreen, onNavigate,
  onBack, projectViewData, onProjectProgressChange, onUpdateProject,
}) {
  const [localProgress, setLocalProgress] = useState(projectViewData?.progress ?? 0);
  const [editingName,   setEditingName]   = useState(false);
  const [nameDraft,     setNameDraft]     = useState('');
  const [statusOpen,    setStatusOpen]    = useState(false);
  const nameInputRef   = useRef(null);
  const statusWrapRef  = useRef(null);

  useEffect(() => {
    setLocalProgress(projectViewData?.progress ?? 0);
  }, [projectViewData?.id, projectViewData?.progress]);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusOpen) return;
    const handler = (e) => {
      if (!statusWrapRef.current?.contains(e.target)) setStatusOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusOpen]);

  const startEditName = () => {
    setNameDraft(projectViewData?.name || '');
    setEditingName(true);
    setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }, 0);
  };

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== projectViewData?.name) {
      onUpdateProject?.(projectViewData.id, { name: trimmed });
    }
    setEditingName(false);
  };

  if (projectViewData) {
    const color = STATUS_COLORS[projectViewData.status] || '#9e9e9c';
    const label = STATUS_LABELS[projectViewData.status] || projectViewData.status;
    return (
      <nav className="top-nav">
        <div className="nav-logo" style={{ paddingLeft: 76 }}>
          <div className="nav-logo-mark">CP</div>
          <span className="nav-logo-word">COPILOT</span>
        </div>
        <button className="nav-back-btn" onClick={onBack}>← Back</button>

        <div className="pv-topnav-center" style={{ WebkitAppRegion: 'no-drag' }}>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="pv-topnav-name-input"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingName(false);
              }}
            />
          ) : (
            <span className="pv-topnav-name" onClick={startEditName} title="Click to rename">
              {projectViewData.name}
            </span>
          )}

          <div ref={statusWrapRef} style={{ position: 'relative' }}>
            <span
              className="pv-topnav-badge pv-topnav-badge-btn"
              style={{ background: color }}
              onClick={() => setStatusOpen(o => !o)}
              title="Change status"
            >
              {label} ▾
            </span>
            {statusOpen && (
              <div className="pv-status-dropdown">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`pv-status-option${projectViewData.status === opt.value ? ' active' : ''}`}
                    onClick={() => {
                      onUpdateProject?.(projectViewData.id, { status: opt.value });
                      setStatusOpen(false);
                    }}
                  >
                    <span className="pv-status-dot" style={{ background: STATUS_COLORS[opt.value] || '#9e9e9c' }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pv-topnav-progress" style={{ WebkitAppRegion: 'no-drag' }}>
          <input
            type="range" min={0} max={100} value={localProgress}
            className="progress-range-sm"
            style={{ width: 100 }}
            onChange={e => setLocalProgress(+e.target.value)}
            onPointerUp={() => onProjectProgressChange?.(projectViewData.id, localProgress)}
          />
          <span className="progress-pct">{localProgress}%</span>
        </div>
      </nav>
    );
  }

  return (
    <nav className="top-nav">
      <div className="nav-logo">
        <div className="nav-logo-mark">CP</div>
        <span className="nav-logo-word">COPILOT</span>
      </div>
      <div className="nav-links">
        {LINKS.map(l => (
          <button
            key={l}
            className={`nav-link${activeScreen === l.toLowerCase() ? ' active' : ''}`}
            onClick={() => onNavigate(l.toLowerCase())}
          >
            {l}
          </button>
        ))}
      </div>
    </nav>
  );
}
