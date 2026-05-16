import React, { useState, useMemo, useEffect } from 'react';

const STATUS_COLORS = {
  active: '#639922', in_progress: '#378ADD',
  just_started: '#EF9F27', overdue: '#E24B4A',
};
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }

export default function CalendarWidget({ projects, onAddTask, onTaskToggle, onExpandTask }) {
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [expanded, setExpanded] = useState(null); // date string | null
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');

  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  useEffect(() => {
    if (expanded && projects.length > 0 && !newTaskProject) {
      setNewTaskProject(projects[0].id);
    }
    if (!expanded) {
      setNewTaskText('');
      setNewTaskProject('');
    }
  }, [expanded, projects]);

  const tasksByDate = useMemo(() => {
    const map = {};
    projects.forEach(p => {
      (p.tasks || []).forEach(t => {
        if (t.dueDate) {
          if (!map[t.dueDate]) map[t.dueDate] = [];
          map[t.dueDate].push({
            taskId: t.id, text: t.text, done: t.done,
            color: STATUS_COLORS[p.status] || '#9e9e9c',
            projectId: p.id, projectName: p.name,
          });
        }
      });
    });
    return map;
  }, [projects]);

  const y = current.getFullYear();
  const m = current.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const handleDayClick = (day) => {
    const key = dateKey(y, m, day);
    setExpanded(prev => prev === key ? null : key);
    if (projects.length > 0) setNewTaskProject(projects[0].id);
    setNewTaskText('');
  };

  const handleAddTask = () => {
    const proj = newTaskProject || projects[0]?.id;
    if (!newTaskText.trim() || !proj || !expanded) return;
    onAddTask(proj, newTaskText.trim(), expanded);
    setNewTaskText('');
  };

  // Week view helpers
  const weekStart = (() => {
    const d = new Date(current);
    d.setDate(d.getDate() - d.getDay());
    return d;
  })();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const expandedTasks = expanded ? (tasksByDate[expanded] || []) : [];
  const expandedLabel = expanded
    ? (() => { const d = new Date(expanded + 'T00:00'); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; })()
    : '';

  return (
    <div className="calendar-widget">
      {/* ── Header ── */}
      <div className="calendar-header">
        <div className="calendar-title">
          {view === 'day'
            ? `${MONTHS[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`
            : view === 'week'
            ? `Week of ${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`
            : `${MONTHS[m]} ${y}`}
        </div>
        <div className="calendar-controls">
          {view === 'month' && !expanded && <>
            <button className="calendar-nav-btn" onClick={() => setCurrent(new Date(y, m - 1, 1))}>‹</button>
            <button className="calendar-nav-btn" onClick={() => setCurrent(new Date(y, m + 1, 1))}>›</button>
          </>}
          <div className="calendar-view-toggle">
            {['month', 'week', 'day'].map(v => (
              <button key={v} className={`cal-view-btn${view === v ? ' active' : ''}`}
                onClick={() => { setView(v); setExpanded(null); }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Month view — two sliding panels inside a fixed viewport ── */}
      {view === 'month' && <>
        <div className="calendar-weekdays">
          {WEEKDAYS.map(d => <div key={d} className="calendar-weekday">{d}</div>)}
        </div>

        <div className="cal-panel-viewport">
          {/* Grid panel — slides out left when a day is expanded */}
          <div className={`cal-panel-grid${expanded ? ' cal-panel-hidden' : ''}`}>
            <div className="calendar-grid">
              {cells.map((day, idx) => {
                if (!day) return <div key={`e${idx}`} className="calendar-cell empty" />;
                const key = dateKey(y, m, day);
                const dots = tasksByDate[key] || [];
                return (
                  <div
                    key={key}
                    className={`calendar-cell${key === todayKey ? ' today' : ''}${expanded === key ? ' selected' : ''}`}
                    onClick={() => handleDayClick(day)}
                  >
                    <span className="cal-day-num">{day}</span>
                    {dots.length > 0 && (
                      <div className="cal-dots">
                        {dots.slice(0, 3).map((t, i) => (
                          <span key={i} className="cal-dot" style={{ background: t.color }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day detail panel — slides in from right */}
          <div className={`cal-panel-day${expanded ? ' cal-panel-visible' : ''}`}>
            {/* Back breadcrumb */}
            <div className="cal-day-header">
              <button className="cal-back-btn" onClick={() => setExpanded(null)}>
                ← {MONTHS[m]} {y}
              </button>
              <span className="cal-day-title">{expandedLabel}</span>
            </div>

            {/* Task list */}
            <div className="cal-day-tasks">
              {expandedTasks.length === 0 && (
                <div className="calendar-no-tasks">
                  No tasks due — add one below
                </div>
              )}
              {expandedTasks.map((t, i) => (
                <div key={i} className="calendar-task-item">
                  <input
                    type="checkbox"
                    checked={!!t.done}
                    onChange={() => onTaskToggle?.(t.projectId, t.taskId)}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="calendar-task-dot" style={{ background: t.color }} />
                  <span className="calendar-task-name" style={{ textDecoration: t.done ? 'line-through' : 'none' }}>
                    {t.text}
                  </span>
                  <span className="calendar-task-project">{t.projectName}</span>
                  <button
                    className="task-expand-btn"
                    title="Expand task"
                    onClick={e => { e.stopPropagation(); onExpandTask?.(t.taskId, t.projectId); }}
                  >▸</button>
                </div>
              ))}
            </div>

            {/* Add task */}
            {projects.length > 0 && (
              <div className="calendar-add-task">
                <input
                  className="calendar-add-input"
                  placeholder="New task…"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                />
                <select
                  className="cal-proj-select"
                  value={newTaskProject || projects[0]?.id || ''}
                  onChange={e => setNewTaskProject(e.target.value)}
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="cal-add-btn" onClick={handleAddTask}>Add</button>
              </div>
            )}
          </div>
        </div>
      </>}

      {/* ── Week view ── */}
      {view === 'week' && (
        <div className="calendar-body">
          <div className="calendar-list-view">
            {weekDays.map(d => {
              const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
              const tasks = tasksByDate[k] || [];
              if (!tasks.length) return null;
              return (
                <React.Fragment key={k}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                    {WEEKDAYS[d.getDay()]} {d.getDate()}
                  </div>
                  {tasks.map((t, i) => (
                    <div key={i} className="cal-list-item">
                      <span className="cal-list-dot" style={{ background: t.color }} />
                      <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>
                        {t.text} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({t.projectName})</span>
                      </span>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
            {weekDays.every(d => !(tasksByDate[dateKey(d.getFullYear(), d.getMonth(), d.getDate())] || []).length) && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No tasks this week</div>
            )}
          </div>
        </div>
      )}

      {/* ── Day view ── */}
      {view === 'day' && (
        <div className="calendar-body">
          <div className="calendar-list-view">
            {(tasksByDate[todayKey] || []).map((t, i) => (
              <div key={i} className="cal-list-item">
                <span className="cal-list-dot" style={{ background: t.color }} />
                <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>
                  {t.text} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({t.projectName})</span>
                </span>
              </div>
            ))}
            {!(tasksByDate[todayKey] || []).length && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No tasks today</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
