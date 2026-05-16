import React, { useState, useEffect, useRef } from 'react';
import TopNav from './components/TopNav';
import Dashboard from './components/Dashboard';
import FloatingChat from './components/FloatingChat';
import ProjectsScreen from './components/ProjectsScreen';
import NotesScreen from './components/NotesScreen';
import SettingsScreen from './components/SettingsScreen';
import TaskModal from './components/TaskModal';
import ProjectView from './components/ProjectView';

const DEFAULT_SETTINGS = {
  heroImage: null,
  userName: 'Saint',
  topics: ['Vocals', 'EQ', 'Compression', 'Bass', 'Reverb', 'Mastering'],
};

export default function App() {
  const [apiKey, setApiKey]         = useState('');
  const [projects, setProjects]     = useState([]);
  const [notes, setNotes]           = useState([]);
  const [settings, setSettings]     = useState(DEFAULT_SETTINGS);
  const [screen, setScreen]         = useState('dashboard');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [chatOpen, setChatOpen]     = useState(false);
  const [highlightProjectId, setHighlightProjectId] = useState(null);
  const [highlightNoteId, setHighlightNoteId]       = useState(null);
  const [expandedTaskInfo, setExpandedTaskInfo]     = useState(null);
  const [previousScreen, setPreviousScreen]         = useState(null);
  const floatingChatRef  = useRef(null);
  const mainContentRef   = useRef(null);

  // ── Scroll to top on navigation ───────────────────────────────────────
  useEffect(() => {
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  }, [screen, activeProjectId]);

  // ── Load all data on mount ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      window.electronAPI.getApiKey(),
      window.electronAPI.getNotes(),
      window.electronAPI.getProjects(),
      window.electronAPI.getSettings(),
    ]).then(([key, n, p, s]) => {
      setApiKey(key || '');
      setNotes(Array.isArray(n) ? n : []);
      const projs = Array.isArray(p) ? p : [];
      setProjects(projs);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
      // Auto-select most recent active project
      const first = projs.find(x => x.status === 'active' || x.status === 'in_progress') || projs[0];
      if (first) setActiveProjectId(first.id);
    });
  }, []);

  // ── Persistence helpers ────────────────────────────────────────────────
  const saveProjects = async (updated) => {
    setProjects(updated);
    await window.electronAPI.saveProjects(updated);
  };

  const saveSettings = async (s) => {
    setSettings(s);
    await window.electronAPI.saveSettings(s);
  };

  // ── Note CRUD ──────────────────────────────────────────────────────────
  const handleSaveNote = async (payload) => {
    const updated = await window.electronAPI.saveNote(payload);
    setNotes(Array.isArray(updated) ? updated : []);
  };

  const handleDeleteNote = async (id) => {
    const updated = await window.electronAPI.deleteNote(id);
    setNotes(Array.isArray(updated) ? updated : []);
  };

  const handleUpdateNote = async (id, changes) => {
    const updated = await window.electronAPI.updateNote(id, changes);
    setNotes(Array.isArray(updated) ? updated : []);
  };

  // ── Project mutations ──────────────────────────────────────────────────
  const handleProgressChange = (id, value) =>
    saveProjects(projects.map(p => p.id === id ? { ...p, progress: value } : p));

  const handleTaskToggle = (id, taskId) =>
    saveProjects(projects.map(p =>
      p.id === id ? { ...p, tasks: (p.tasks || []).map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : p
    ));

  const handleTaskDateChange = (projectId, taskId, date) =>
    saveProjects(projects.map(p =>
      p.id === projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === taskId ? { ...t, dueDate: date } : t) } : p
    ));

  const handleSwapProjectImage = (projectId, dataUrl) =>
    saveProjects(projects.map(p => p.id === projectId ? { ...p, moodImage: dataUrl } : p));

  const handleSelectProject = (projectId) => {
    handleOpenProjectView(projectId);
  };

  const handleSelectNote = (noteId) => {
    setHighlightNoteId(noteId);
    setScreen('notes');
  };

  const handleAddTask = (projectId, text, dueDate) =>
    saveProjects(projects.map(p =>
      p.id === projectId
        ? { ...p, tasks: [...(p.tasks || []), { id: String(Date.now()), text, done: false, dueDate: dueDate || null }] }
        : p
    ));

  const handleNewProject = () => {
    const p = {
      id: String(Date.now()), name: 'New Project', status: 'just_started',
      progress: 0, moodImage: null, tasks: [], chatHistory: [],
      quickAsks: ['How do I compress vocals?', 'Read my session', "What's muddy?", 'Suggest a chain'],
      createdAt: new Date().toISOString(),
    };
    const updated = [p, ...projects];
    saveProjects(updated);
    setActiveProjectId(p.id);
    setScreen('projects');
  };

  const handleMessagesChange = (projectId, messages) =>
    saveProjects(projects.map(p => p.id === projectId ? { ...p, chatHistory: messages } : p));

  const handleExpandTask = (taskId, projectId) => setExpandedTaskInfo({ taskId, projectId });

  const handleUpdateTaskDetails = (projectId, taskId, changes) =>
    saveProjects(projects.map(p =>
      p.id === projectId
        ? { ...p, tasks: (p.tasks || []).map(t => t.id === taskId ? { ...t, ...changes } : t) }
        : p
    ));

  const handleOpenProjectView = (projectId) => {
    setActiveProjectId(projectId);
    setPreviousScreen(screen);
    setChatOpen(false);
    setScreen('project-view');
  };

  const handleBackFromProject = () => {
    setScreen(previousScreen || 'dashboard');
  };

  const handleUpdateProject = (projectId, changes) => {
    saveProjects(projects.map(p => p.id === projectId ? { ...p, ...changes } : p));
  };

  // ── Chat open/close ────────────────────────────────────────────────────
  const handleOpenChat = (projectId, quickAsk) => {
    if (projectId) setActiveProjectId(projectId);
    setChatOpen(true);
    if (quickAsk) {
      setTimeout(() => floatingChatRef.current?.sendQuickAsk?.(quickAsk), 100);
    }
  };

  const handleStartVoice = () => {
    setChatOpen(true);
    setTimeout(() => floatingChatRef.current?.startVoice?.(), 150);
  };

  const handleStopVoice = () => {
    floatingChatRef.current?.stopVoice?.();
  };

  const handleCapture = () => {
    setChatOpen(true);
    setTimeout(() => floatingChatRef.current?.triggerCapture?.(), 150);
  };

  // ── Topics ─────────────────────────────────────────────────────────────
  const handleAddTopic = (name) => {
    const updated = { ...settings, topics: [...(settings.topics || []), name] };
    saveSettings(updated);
  };

  const topics = settings.topics || DEFAULT_SETTINGS.topics;

  return (
    <div className="app">
      <TopNav
        activeScreen={screen}
        onNavigate={setScreen}
        onBack={handleBackFromProject}
        projectViewData={screen === 'project-view' ? projects.find(p => p.id === activeProjectId) : null}
        onProjectProgressChange={handleProgressChange}
        onUpdateProject={handleUpdateProject}
      />

      <div className="main-content" ref={mainContentRef}>
        {screen === 'project-view' && (() => {
          const proj = projects.find(p => p.id === activeProjectId);
          if (!proj) return null;
          return (
            <ProjectView
              project={proj}
              projects={projects}
              notes={notes}
              topics={topics}
              apiKey={apiKey}
              onUpdateProject={handleUpdateProject}
              onSaveNote={handleSaveNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onBack={handleBackFromProject}
              onOpenChat={handleOpenChat}
            />
          );
        })()}

        {screen === 'dashboard' && (
          <Dashboard
            projects={projects}
            notes={notes}
            settings={settings}
            topics={topics}
            activeProjectId={activeProjectId}
            onProgressChange={handleProgressChange}
            onTaskToggle={handleTaskToggle}
            onTaskDateChange={handleTaskDateChange}
            onOpenChat={handleOpenChat}
            onNewProject={handleNewProject}
            onSwapHeroImage={img => saveSettings({ ...settings, heroImage: img })}
            onSwapProjectImage={handleSwapProjectImage}
            onExpandTask={handleExpandTask}
            onSaveNote={handleSaveNote}
            onNavigate={setScreen}
            onDeleteNote={handleDeleteNote}
            onAddTopic={handleAddTopic}
            onAddTask={handleAddTask}
            onStartVoice={handleStartVoice}
            onStopVoice={handleStopVoice}
            onCapture={handleCapture}
            onSelectProject={handleSelectProject}
            onSelectNote={handleSelectNote}
            onUpdateNote={handleUpdateNote}
          />
        )}

        {screen === 'projects' && (
          <ProjectsScreen
            projects={projects}
            onUpdateProjects={saveProjects}
            onOpenChat={handleOpenChat}
            onExpandTask={handleExpandTask}
            onOpenProjectView={handleOpenProjectView}
            highlightProjectId={highlightProjectId}
          />
        )}

        {screen === 'notes' && (
          <NotesScreen
            notes={notes}
            topics={topics}
            projects={projects}
            onDeleteNote={handleDeleteNote}
            onAddTopic={handleAddTopic}
            onUpdateNote={handleUpdateNote}
            onSaveNote={handleSaveNote}
            highlightNoteId={highlightNoteId}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen settings={settings} onSave={saveSettings} />
        )}
      </div>

      {expandedTaskInfo && (() => {
        const proj = projects.find(p => p.id === expandedTaskInfo.projectId);
        const task = proj?.tasks?.find(t => t.id === expandedTaskInfo.taskId);
        if (!proj || !task) return null;
        return (
          <TaskModal
            task={task}
            project={proj}
            onUpdate={changes => handleUpdateTaskDetails(proj.id, task.id, changes)}
            onClose={() => setExpandedTaskInfo(null)}
          />
        );
      })()}

      <FloatingChat
        ref={floatingChatRef}
        apiKey={apiKey}
        topics={topics}
        projects={projects}
        activeProjectId={activeProjectId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onSaveNote={handleSaveNote}
        onMessagesChange={handleMessagesChange}
      />
    </div>
  );
}
