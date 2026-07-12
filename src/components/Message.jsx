import React, { useState } from 'react';

function getDisplayText(message) {
  if (message.displayText) return message.displayText;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    const block = message.content.find(b => b.type === 'text');
    return block ? block.text : '';
  }
  return '';
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/gs, '$1')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^[-*_]{3,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function Message({ message, onSave, topics }) {
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isUser = message.role === 'user';
  const text = getDisplayText(message);

  const handleSaveClick = () => setPickerOpen(true);

  const handlePickTopic = (topic) => {
    onSave({ text: message.content, topic });
    setSaved(true);
    setPickerOpen(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-header">
        <span className="message-role">{isUser ? 'YOU' : 'AYTIV'}</span>
        {!isUser && !saved && (
          <button className="btn-save-note" onClick={handleSaveClick} title="Save to notes">
            Save
          </button>
        )}
        {!isUser && saved && (
          <button className="btn-save-note saved">✓ Saved</button>
        )}
      </div>

      {message.hasScreenshot && (
        <div className="screenshot-badge">📸 Screen captured</div>
      )}

      <div className={`message-body ${message.streaming ? 'streaming' : ''}`}>
        {stripMarkdown(text)}
        {message.streaming && <span className="cursor-blink">▊</span>}
      </div>

      {pickerOpen && (
        <div className="topic-picker">
          <div className="topic-picker-label">Save to topic:</div>
          <div className="topic-picker-chips">
            {(topics || []).map(t => (
              <button key={t} className="topic-picker-chip" onClick={() => handlePickTopic(t)}>{t}</button>
            ))}
            <button className="topic-picker-chip" onClick={() => handlePickTopic(null)}>No topic</button>
            <button className="topic-picker-chip" style={{ borderColor: 'var(--border2)' }} onClick={() => setPickerOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
