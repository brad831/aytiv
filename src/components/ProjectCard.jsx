import React, { useState, useEffect } from 'react';

const STATUS_COLORS = {
  active: '#639922',
  in_progress: '#378ADD',
  just_started: '#EF9F27',
  overdue: '#E24B4A',
};
const STATUS_LABELS = {
  active: 'Active',
  in_progress: 'In Progress',
  just_started: 'Just Started',
  overdue: 'Overdue',
};

export default function ProjectCard({
  project, isActive,
  onProgressChange, onTaskToggle, onOpenChat, onSelectProject, onSwapImage, onExpandTask,
}) {
  const [localProgress, setLocalProgress] = useState(project.progress ?? 0);
  useEffect(() => setLocalProgress(project.progress ?? 0), [project.progress]);

  const handleSwapImage = async (e) => {
    e.stopPropagation();
    const result = await window.electronAPI.pickImage();
    if (result) onSwapImage?.(project.id, result);
  };

  const color = STATUS_COLORS[project.status] || '#9e9e9c';
  const imgStyle = project.moodImage ? { backgroundImage: `url("${project.moodImage}")` } : {};
  const allTasks = project.tasks || [];
  const tasks = allTasks.slice(0, 4);
  const hiddenCount = allTasks.length - 4;

  return (
    <div
      className={`project-card${isActive ? ' active-project' : ''}`}
      onClick={() => onSelectProject?.(project.id)}
    >
      <div className="project-card-image" style={imgStyle}>
        <button className="card-swap-img-btn" onClick={handleSwapImage} title="Swap image">📷</button>
      </div>

      <div className="project-card-body">
        <div className="project-name" title={project.name}>{project.name}</div>

        <div className="project-status-progress-row">
          <span className="project-status-pill" style={{ background: color }}>
            {STATUS_LABELS[project.status] || project.status}
          </span>
          <input
            type="range" min={0} max={100} value={localProgress}
            className="progress-range-sm"
            onChange={e => { e.stopPropagation(); setLocalProgress(+e.target.value); }}
            onPointerUp={e => { e.stopPropagation(); onProgressChange(project.id, localProgress); }}
            onClick={e => e.stopPropagation()}
          />
          <span className="progress-pct">{localProgress}%</span>
        </div>

        {tasks.length > 0 && (
          <div className="project-tasks">
            {tasks.map(t => (
              <div key={t.id} className="task-row">
                <input
                  type="checkbox" id={`t-${t.id}`} checked={!!t.done}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); onTaskToggle(project.id, t.id); }}
                />
                <label htmlFor={`t-${t.id}`} style={{ flex: 1 }}>{t.text}</label>
                <button
                  className="task-expand-btn"
                  title="Expand task"
                  onClick={e => { e.stopPropagation(); onExpandTask?.(t.id, project.id); }}
                >▸</button>
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                className="card-view-all-btn"
                onClick={e => { e.stopPropagation(); onSelectProject?.(project.id); }}
              >+{hiddenCount} more · View all</button>
            )}
          </div>
        )}
      </div>

      <div className="project-card-footer">
        <button className="btn-open-chat" onClick={e => { e.stopPropagation(); onOpenChat(project.id); }}>
          Open chat
        </button>
      </div>
    </div>
  );
}
