import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import ChatPanel from './ChatPanel';

const FloatingChat = forwardRef(function FloatingChat(
  { apiKey, topics, projects, activeProjectId, isOpen, onClose, onSaveNote, onMessagesChange },
  ref
) {
  const posRef = useRef({ x: 80, y: 80 });
  const containerRef = useRef(null);
  const chatPanelRef = useRef(null);

  useImperativeHandle(ref, () => ({
    startVoice:    () => chatPanelRef.current?.startVoice?.(),
    stopVoice:     () => chatPanelRef.current?.stopVoice?.(),
    triggerCapture:() => chatPanelRef.current?.triggerCapture?.(),
    sendQuickAsk:  (text) => chatPanelRef.current?.sendQuickAsk?.(text),
  }));

  const onPointerDown = e => {
    if (e.target.closest('button, input, textarea, select')) return;
    e.preventDefault();
    const startX = e.clientX - posRef.current.x;
    const startY = e.clientY - posRef.current.y;
    const onMove = e => {
      posRef.current = { x: e.clientX - startX, y: e.clientY - startY };
      if (containerRef.current) {
        containerRef.current.style.left = posRef.current.x + 'px';
        containerRef.current.style.top = posRef.current.y + 'px';
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const activeProject = projects.find(p => p.id === activeProjectId);
  const initialMessages = activeProject?.chatHistory ?? [];

  const handleMessagesChange = msgs => {
    if (activeProjectId) onMessagesChange(activeProjectId, msgs);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="floating-chat"
      style={{ left: posRef.current.x, top: posRef.current.y, height: 560 }}
    >
      <div className="floating-chat-titlebar" onPointerDown={onPointerDown}>
        <span className="fc-title">Session Engineer</span>
        {activeProject && <span className="fc-project-tag">{activeProject.name}</span>}
        <button className="fc-close" onClick={onClose}>×</button>
      </div>
      <div className="floating-chat-body">
        <ChatPanel
          key={activeProjectId ?? 'global'}
          ref={chatPanelRef}
          apiKey={apiKey}
          initialMessages={initialMessages}
          onSaveNote={onSaveNote}
          onMessagesChange={handleMessagesChange}
          projectId={activeProjectId}
          topics={topics}
        />
      </div>
    </div>
  );
});

export default FloatingChat;
