import React from 'react';
import ProjectCard from './ProjectCard';

export default function ProjectCards({
  projects, activeProjectId,
  onProgressChange, onTaskToggle, onTaskDateChange,
  onOpenChat, onNewProject, onSelectProject, onSwapImage, onExpandTask,
}) {
  return (
    <div className="project-cards-row">
      {projects.map(p => (
        <ProjectCard
          key={p.id}
          project={p}
          isActive={p.id === activeProjectId}
          onProgressChange={onProgressChange}
          onTaskToggle={onTaskToggle}
          onTaskDateChange={onTaskDateChange}
          onOpenChat={onOpenChat}
          onSelectProject={onSelectProject}
          onSwapImage={onSwapImage}
          onExpandTask={onExpandTask}
        />
      ))}
      <div className="new-project-card" onClick={onNewProject}>
        <span className="new-project-icon">+</span>
        <span className="new-project-label">New project</span>
      </div>
    </div>
  );
}
