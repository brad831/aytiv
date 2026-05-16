import React from 'react';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HeroHeader({ heroImage, userName, projects, onNewProject, onSwapImage }) {
  const activeCount = projects.filter(p => p.status === 'active' || p.status === 'in_progress').length;
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = projects.reduce((n, p) => n + (p.tasks || []).filter(t => !t.done && t.dueDate === today).length, 0);

  const handleSwap = async () => {
    const result = await window.electronAPI.pickImage();
    if (result) onSwapImage(result);
  };

  return (
    <div className="hero-header">
      {heroImage && <div className="hero-bg" style={{ backgroundImage: `url("${heroImage}")` }} />}
      <div className="hero-overlay" />
      <div className="hero-content">
        <div className="hero-greeting">{greeting()}, {userName}.</div>
        <div className="hero-sub">
          {activeCount} active project{activeCount !== 1 ? 's' : ''}
          {dueToday > 0 ? ` · ${dueToday} task${dueToday !== 1 ? 's' : ''} due today` : ''}
        </div>
      </div>
      <div className="hero-actions">
        <button className="hero-btn" onClick={handleSwap}>Swap image</button>
        <button className="hero-btn primary" onClick={onNewProject}>+ New project</button>
      </div>
    </div>
  );
}
