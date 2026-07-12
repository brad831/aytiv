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

function WorkspaceSwitcher({ workspaces, activeWorkspaceId, onSwitch, onNew, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const [menuWsId, setMenuWsId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = e => { if (!ref.current?.contains(e.target)) { setOpen(false); setMenuWsId(null); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="ws-switcher" ref={ref} style={{ paddingLeft: 76 }}>
      <button className="ws-logo-btn" onClick={() => setOpen(o => !o)}>
        <div className="nav-logo-mark">AY</div>
        <span className="nav-logo-word">AYTIV</span>
        <span className="ws-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="ws-dropdown">
          {workspaces.map(ws => {
            if (editingId === ws.id) {
              return (
                <div key={ws.id} className="ws-item ws-item-editing">
                  <input
                    className="ws-rename-input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') { onRename(ws.id, editName.trim() || ws.name); setEditingId(null); }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button className="ws-item-action" onClick={() => { onRename(ws.id, editName.trim() || ws.name); setEditingId(null); }}>Save</button>
                  <button className="ws-item-action secondary" onClick={() => setEditingId(null)}>✕</button>
                </div>
              );
            }
            if (confirmDeleteId === ws.id) {
              return (
                <div key={ws.id} className="ws-item ws-item-confirm">
                  <span className="ws-delete-warn">Delete "{ws.name}"?</span>
                  <button className="ws-item-action danger" onClick={() => { onDelete(ws.id); setConfirmDeleteId(null); }}>Delete</button>
                  <button className="ws-item-action secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                </div>
              );
            }
            return (
              <div
                key={ws.id}
                className={`ws-item${ws.id === activeWorkspaceId ? ' ws-item-active' : ''}`}
                onClick={() => { if (menuWsId !== ws.id) { onSwitch(ws.id); setOpen(false); setMenuWsId(null); } }}
              >
                <span className={`ws-mode-dot${ws.mode === 'dark' ? ' dark' : ''}`} />
                <span className="ws-item-name">{ws.name}</span>
                {ws.id === activeWorkspaceId && <span className="ws-active-check">✓</span>}
                <button
                  className="ws-gear-btn"
                  title="Rename or delete"
                  onClick={e => { e.stopPropagation(); setMenuWsId(id => id === ws.id ? null : ws.id); }}
                >⚙</button>
                {menuWsId === ws.id && (
                  <div className="ws-gear-menu" onClick={e => e.stopPropagation()}>
                    <button className="ws-gear-item" onClick={() => { setEditName(ws.name); setEditingId(ws.id); setMenuWsId(null); }}>Rename</button>
                    <button
                      className="ws-gear-item danger"
                      disabled={workspaces.length <= 1}
                      onClick={() => { setConfirmDeleteId(ws.id); setMenuWsId(null); }}
                    >Delete</button>
                  </div>
                )}
              </div>
            );
          })}
          <button className="ws-new-btn" onClick={() => { setOpen(false); onNew(); }}>
            + New workspace
          </button>
        </div>
      )}
    </div>
  );
}

export default function TopNav({
  activeScreen, onNavigate,
  onBack, projectViewData, onProjectProgressChange, onUpdateProject,
  workspaces, activeWorkspaceId, onSwitchWorkspace, onNewWorkspace, onRenameWorkspace, onDeleteWorkspace,
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
        <WorkspaceSwitcher
          workspaces={workspaces || []}
          activeWorkspaceId={activeWorkspaceId}
          onSwitch={onSwitchWorkspace}
          onNew={onNewWorkspace}
          onRename={onRenameWorkspace}
          onDelete={onDeleteWorkspace}
        />
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
      <WorkspaceSwitcher
        workspaces={workspaces || []}
        activeWorkspaceId={activeWorkspaceId}
        onSwitch={onSwitchWorkspace}
        onNew={onNewWorkspace}
        onRename={onRenameWorkspace}
        onDelete={onDeleteWorkspace}
      />
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
