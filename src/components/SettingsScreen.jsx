import React, { useState, useRef } from 'react';

export default function SettingsScreen({ settings, onSave }) {
  const [local, setLocal] = useState({ ...settings });
  const [newTopic, setNewTopic] = useState('');
  const fileRef = useRef(null);

  const handleImage = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLocal(l => ({ ...l, heroImage: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeTopic = t => setLocal(l => ({ ...l, topics: l.topics.filter(x => x !== t) }));

  const addTopic = () => {
    const t = newTopic.trim();
    if (t && !local.topics.includes(t)) setLocal(l => ({ ...l, topics: [...l.topics, t] }));
    setNewTopic('');
  };

  return (
    <div className="screen">
      <h1 className="screen-title">Settings</h1>
      <p className="screen-sub">Customize your Copilot experience</p>

      <form className="settings-form" onSubmit={e => { e.preventDefault(); onSave(local); }}>
        <div className="settings-field">
          <label>Your name</label>
          <input className="settings-input" value={local.userName || ''} onChange={e => setLocal(l => ({ ...l, userName: e.target.value }))} placeholder="Saint" />
        </div>

        <div className="settings-field">
          <label>Hero background image</label>
          <div className="hero-image-picker">
            <div className="hero-preview" style={{ backgroundImage: local.heroImage ? `url(${local.heroImage})` : undefined }} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
            <button type="button" className="upload-btn" onClick={() => fileRef.current?.click()}>
              {local.heroImage ? 'Change image' : 'Upload image'}
            </button>
            {local.heroImage && (
              <button type="button" className="upload-btn" style={{ color: 'var(--status-overdue)' }}
                onClick={() => setLocal(l => ({ ...l, heroImage: null }))}>Remove</button>
            )}
          </div>
        </div>

        <div className="settings-field">
          <label>Note topics</label>
          <div className="topics-manager">
            {(local.topics || []).map(t => (
              <div key={t} className="topic-remove-pill">
                {t}
                <button type="button" className="topic-remove-btn" onClick={() => removeTopic(t)}>×</button>
              </div>
            ))}
            <input
              className="add-topic-input" placeholder="Add topic…"
              value={newTopic} onChange={e => setNewTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
            />
          </div>
        </div>

        <button type="submit" className="settings-save-btn">Save settings</button>
      </form>
    </div>
  );
}
