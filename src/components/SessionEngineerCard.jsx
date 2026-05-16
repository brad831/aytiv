import React from 'react';

const DEFAULT_ASKS = [
  'How do I compress vocals?',
  'Read my session',
  "What's muddy?",
  'Suggest a chain',
];

export default function SessionEngineerCard({ activeProject, onOpenChat, onStartVoice, onStopVoice, onCapture }) {
  const asks = activeProject?.quickAsks?.length ? activeProject.quickAsks : DEFAULT_ASKS;

  // Push-to-talk: start on pointerdown, stop on pointerup/leave.
  // preventDefault stops the browser from treating this as a focus or text-selection
  // event that could route through macOS Siri's microphone listener.
  const handleVoiceDown = (e) => {
    e.preventDefault();
    onStartVoice?.();
  };
  const handleVoiceUp = (e) => {
    e.preventDefault();
    onStopVoice?.();
  };

  return (
    <div className="session-engineer-card">
      <div className="se-header">
        <div className="se-avatar">🎛</div>
        <div className="se-info">
          <div className="se-name">Session Engineer</div>
          <div className="se-status">
            <span className="se-online-dot" />
            <span>Online</span>
          </div>
        </div>
        {activeProject && (
          <span className="se-project-tag">{activeProject.name}</span>
        )}
      </div>

      <div className="se-description">
        Your AI mixing assistant — ask anything about your session, get mix notes, plugin suggestions, and real-time feedback.
      </div>

      <div className="se-actions">
        <button className="se-btn primary" onClick={() => onOpenChat(activeProject?.id ?? null)}>Open</button>
        <button
          className="se-btn"
          onPointerDown={handleVoiceDown}
          onPointerUp={handleVoiceUp}
          onPointerLeave={handleVoiceUp}
          title="Hold to speak"
        >Voice</button>
        <button className="se-btn" onClick={onCapture}>Capture</button>
      </div>

      <div className="quick-asks">
        <div className="quick-ask-section-label">Quick asks</div>
        {asks.map((q, i) => (
          <button
            key={i}
            className="quick-ask-chip"
            onClick={() => onOpenChat(activeProject?.id ?? null, q)}
          >{q}</button>
        ))}
      </div>
    </div>
  );
}
