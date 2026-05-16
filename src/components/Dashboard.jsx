import React from 'react';
import HeroHeader from './HeroHeader';
import ProjectCards from './ProjectCards';
import CalendarWidget from './CalendarWidget';
import DashboardNotes from './DashboardNotes';
import SessionEngineerCard from './SessionEngineerCard';

export default function Dashboard({
  projects, notes, settings, topics,
  activeProjectId,
  onProgressChange, onTaskToggle, onTaskDateChange, onOpenChat, onNewProject,
  onSwapHeroImage, onSwapProjectImage, onExpandTask, onNavigate, onDeleteNote, onAddTopic,
  onSaveNote, onAddTask, onStartVoice, onStopVoice, onCapture, onSelectProject, onSelectNote, onUpdateNote,
}) {
  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  return (
    <div className="dashboard">
      <HeroHeader
        heroImage={settings.heroImage}
        userName={settings.userName}
        projects={projects}
        onNewProject={onNewProject}
        onSwapImage={onSwapHeroImage}
      />

      <div className="dashboard-mid">
        <CalendarWidget projects={projects} onAddTask={onAddTask} onTaskToggle={onTaskToggle} onExpandTask={onExpandTask} />
        <div className="dashboard-projects-col">
          <div className="section-label">Projects</div>
          <ProjectCards
            projects={projects}
            activeProjectId={activeProjectId}
            onProgressChange={onProgressChange}
            onTaskToggle={onTaskToggle}
            onTaskDateChange={onTaskDateChange}
            onOpenChat={onOpenChat}
            onNewProject={onNewProject}
            onSelectProject={onSelectProject}
            onSwapImage={onSwapProjectImage}
            onExpandTask={onExpandTask}
          />
        </div>
      </div>

      <div className="dashboard-bottom">
        <DashboardNotes
          notes={notes}
          topics={topics}
          projects={projects}
          onNavigate={onNavigate}
          onDeleteNote={onDeleteNote}
          onAddTopic={onAddTopic}
          onSaveNote={onSaveNote}
          onSelectNote={onSelectNote}
          onUpdateNote={onUpdateNote}
        />
        <SessionEngineerCard
          activeProject={activeProject}
          onOpenChat={onOpenChat}
          onStartVoice={onStartVoice}
          onStopVoice={onStopVoice}
          onCapture={onCapture}
        />
      </div>
    </div>
  );
}
