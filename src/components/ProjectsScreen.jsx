import React, { useState, useRef, useEffect, useCallback } from 'react';

function fmtShort(dateStr) {
  if (!dateStr) return null;
  const [, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

const STATUS_COLORS = {
  active: '#639922', in_progress: '#378ADD',
  just_started: '#EF9F27', overdue: '#E24B4A',
};
const STATUS_OPTIONS = [
  { value: 'just_started', label: 'Just Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
];

export default function ProjectsScreen({ projects, onUpdateProjects, onOpenChat, onExpandTask, onOpenProjectView, highlightProjectId }) {
  const [newTaskTexts, setNewTaskTexts] = useState({});
  const cardRefs = useRef({});
  const dateRefs = useRef({});

  // Scroll to and briefly highlight the selected project
  useEffect(() => {
    if (highlightProjectId && cardRefs.current[highlightProjectId]) {
      cardRefs.current[highlightProjectId].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [highlightProjectId]);

  const update = (id, changes) =>
    onUpdateProjects(projects.map(p => p.id === id ? { ...p, ...changes } : p));

  const deleteProject = id =>
    onUpdateProjects(projects.filter(p => p.id !== id));

  const addTask = (id) => {
    const text = (newTaskTexts[id] || '').trim();
    if (!text) return;
    const project = projects.find(p => p.id === id);
    const task = { id: String(Date.now()), text, done: false, dueDate: null };
    update(id, { tasks: [...(project.tasks || []), task] });
    setNewTaskTexts(prev => ({ ...prev, [id]: '' }));
  };

  const toggleTask = (projectId, taskId) => {
    const p = projects.find(x => x.id === projectId);
    update(projectId, { tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) });
  };

  const removeTask = (projectId, taskId) => {
    const p = projects.find(x => x.id === projectId);
    update(projectId, { tasks: p.tasks.filter(t => t.id !== taskId) });
  };

  const handleImage = async (projectId) => {
    const result = await window.electronAPI.pickImage();
    if (result) update(projectId, { moodImage: result });
  };

  const newProject = () => {
    const p = {
      id: String(Date.now()), name: 'New Project', status: 'just_started',
      progress: 0, moodImage: null, tasks: [], chatHistory: [],
      quickAsks: ['How do I compress vocals?', 'Read my session', "What's muddy?", 'Suggest a chain'],
      createdAt: new Date().toISOString(),
    };
    onUpdateProjects([p, ...projects]);
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="screen-title">Projects</h1>
        <button className="add-task-btn" style={{ fontSize: 12 }} onClick={newProject}>+ New Project</button>
      </div>
      <p className="screen-sub">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>

      <div className="projects-grid">
        {projects.map(p => (
          <div
            key={p.id}
            ref={el => cardRefs.current[p.id] = el}
            className="project-detail-card"
            style={p.id === highlightProjectId ? { boxShadow: '0 0 0 2px var(--status-in_progress)', outline: 'none' } : {}}
          >
            <div
              className="project-detail-image"
              style={{ backgroundImage: p.moodImage ? `url("${p.moodImage}")` : undefined, backgroundColor: STATUS_COLORS[p.status] || '#1a1a1a', cursor: 'pointer' }}
              onClick={() => onOpenProjectView?.(p.id)}
              title="Open project view"
            >
              <div className="pdi-actions">
                <button className="pdi-img-btn" onClick={e => { e.stopPropagation(); handleImage(p.id); }}>📷 Image</button>
              </div>
            </div>
            <div className="project-detail-body">
              <input
                className="project-detail-name-input"
                value={p.name}
                onChange={e => update(p.id, { name: e.target.value })}
                style={{ marginBottom: 8, display: 'block', width: '100%' }}
              />
              <div style={{ marginBottom: 12 }}>
                <span className="status-badge-inline" style={{ background: STATUS_COLORS[p.status] || '#9e9e9c' }}>
                  {STATUS_OPTIONS.find(s => s.value === p.status)?.label}
                </span>
              </div>

              <div className="project-field">
                <label>Status</label>
                <select className="project-status-select" value={p.status} onChange={e => update(p.id, { status: e.target.value })}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="project-field">
                <label>Progress — {p.progress || 0}%</label>
                <input type="range" min={0} max={100} value={p.progress || 0} className="progress-range"
                  onChange={e => update(p.id, { progress: +e.target.value })} />
              </div>

              <div className="project-field">
                <label>Tasks</label>
                <div className="project-task-list">
                  {(p.tasks || []).map(t => (
                    <div key={t.id} className="project-task-row">
                      <input type="checkbox" checked={!!t.done} onChange={() => toggleTask(p.id, t.id)} />
                      <input type="text" value={t.text}
                        onChange={e => update(p.id, { tasks: p.tasks.map(x => x.id === t.id ? { ...x, text: e.target.value } : x) })}
                      />
                      <button
                        className="task-expand-btn"
                        title="Expand task"
                        onClick={() => onExpandTask?.(t.id, p.id)}
                      >▸</button>
                      <input
                        type="date"
                        ref={el => dateRefs.current[`${p.id}-${t.id}`] = el}
                        value={t.dueDate || ''}
                        style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }}
                        onChange={e => update(p.id, { tasks: p.tasks.map(x => x.id === t.id ? { ...x, dueDate: e.target.value || null } : x) })}
                      />
                      <button
                        className="project-task-date-btn"
                        title={t.dueDate ? `Due ${fmtShort(t.dueDate)} — click to change` : 'Set due date'}
                        onClick={() => {
                          const inp = dateRefs.current[`${p.id}-${t.id}`];
                          if (inp) { inp.style.pointerEvents = 'auto'; inp.showPicker?.(); inp.style.pointerEvents = 'none'; }
                        }}
                      >{t.dueDate ? fmtShort(t.dueDate) : '—'}</button>
                      <button className="project-task-delete" onClick={() => removeTask(p.id, t.id)}>×</button>
                    </div>
                  ))}
                </div>
                <div className="add-task-row">
                  <input className="add-task-input" placeholder="New task…"
                    value={newTaskTexts[p.id] || ''}
                    onChange={e => setNewTaskTexts(prev => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTask(p.id)}
                  />
                  <button className="add-task-btn" onClick={() => addTask(p.id)}>Add</button>
                </div>
              </div>

              <div className="project-detail-actions">
                <button className="pd-btn primary" onClick={() => onOpenProjectView?.(p.id)}>Open</button>
                <button className="pd-btn" onClick={() => onOpenChat(p.id)}>Chat</button>
                <button className="pd-btn danger" onClick={() => { if (window.confirm(`Delete "${p.name}"?`)) deleteProject(p.id); }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
