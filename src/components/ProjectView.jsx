import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatPanel from './ChatPanel';
import FloatingWindow from './FloatingWindow';

const STATUS_COLORS = {
  active: '#639922', in_progress: '#378ADD',
  just_started: '#EF9F27', overdue: '#E24B4A',
};
const STATUS_LABELS = {
  active: 'Active', in_progress: 'In Progress',
  just_started: 'Just Started', overdue: 'Overdue',
};
const CATEGORY_COLORS = { Demo: '#EF9F27', Finished: '#639922', Reference: '#378ADD' };

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fmtShortDate(s) {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${m}/${d}`;
}

function splitTitle(n) {
  const body = typeof n.text === 'string' ? n.text : '';
  if (n.title?.trim()) return { title: n.title.trim(), body };
  const idx = body.search(/[.!?\n]/);
  if (idx > 0 && idx < 120) return { title: body.slice(0, idx + 1).trim(), body: body.slice(idx + 1).trim() };
  return { title: body.slice(0, 80).trim(), body: body.slice(80).trim() };
}

// ── Floating placeholder ──────────────────────────────────────────────────
function FloatingPlaceholder({ label, onReopen }) {
  return (
    <div className="pv-card pv-floating-placeholder">
      <span className="pv-fp-label">{label} — open in window</span>
      <button className="pv-fp-btn" onClick={onReopen}>Bring back</button>
    </div>
  );
}

// ── Card header ───────────────────────────────────────────────────────────
function CardHeader({ title, onExpand, children }) {
  return (
    <div className="pv-card-header">
      <span className="pv-card-title">{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {children}
        <button className="pv-expand-btn" title="Open in floating window" onClick={onExpand}>⤢</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
export default function ProjectView({
  project, projects, notes, topics, apiKey,
  onUpdateProject, onSaveNote, onUpdateNote, onDeleteNote, onBack,
}) {
  // ── Data defaults ────────────────────────────────────────────────────────
  const tracks        = project.tracks        || [];
  const albumArt      = project.albumArt      || null;
  const albumTitle    = project.albumTitle    || '';
  const artistName    = project.artistName    || '';
  const moodboardImgs = project.moodboardImages || (project.moodImage ? [project.moodImage] : []);
  const lyrics        = project.lyrics        || [];
  const missionStmt   = project.missionStatement || '';

  const update = useCallback((changes) => onUpdateProject(project.id, changes), [project.id, onUpdateProject]);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const audioRef        = useRef(null);
  const [trackFilter,   setTrackFilter]   = useState('All');
  const [currentIdx,    setCurrentIdx]    = useState(0);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [audioTime,     setAudioTime]     = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const filteredTracks = trackFilter === 'All' ? tracks : tracks.filter(t => t.category === trackFilter);
  const currentTrack   = filteredTracks[currentIdx] || null;
  const [audioError,      setAudioError]      = useState('');
  const [pendingTrack,    setPendingTrack]    = useState(null);
  const CATEGORIES = ['Demo', 'Finished', 'Reference'];

  // Single effect: reload src whenever the actual file path changes (covers first
  // track added, filter changes, and index changes in one place).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError('');
    if (!currentTrack?.filePath) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    audio.src = currentTrack.filePath;
    if (isPlaying) {
      audio.play().catch(err => {
        setAudioError(`Can't play "${currentTrack.title}": ${err.message}`);
        setIsPlaying(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.filePath]);

  // Separate effect: handle play/pause toggle without reloading the src.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.filePath) return;
    if (isPlaying) {
      audio.play().catch(err => {
        setAudioError(`Can't play "${currentTrack.title}": ${err.message}`);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const playTrack = (idx) => {
    if (currentIdx === idx) { setIsPlaying(p => !p); return; }
    setCurrentIdx(idx);
    setIsPlaying(true);
  };

  const skipTo = (delta) => {
    const n = filteredTracks.length;
    if (!n) return;
    setCurrentIdx(i => (i + delta + n) % n);
    setIsPlaying(true);
  };

  const scrub = (pct) => {
    if (!audioRef.current || !audioDuration) return;
    audioRef.current.currentTime = (pct / 100) * audioDuration;
  };

  const addTrack = async () => {
    const r = await window.electronAPI.pickAudio();
    if (r) setPendingTrack(r);
  };

  const confirmAddTrack = (category) => {
    if (!pendingTrack) return;
    update({
      tracks: [...tracks, {
        id: String(Date.now()), title: pendingTrack.name, bpm: '', format: pendingTrack.ext,
        duration: '', category, filePath: pendingTrack.url,
        date: new Date().toISOString().slice(0, 10), order: tracks.length,
      }],
    });
    setPendingTrack(null);
  };

  const deleteTrack = (trackId) => {
    update({ tracks: tracks.filter(t => t.id !== trackId) });
  };

  const cycleTrackCategory = (trackId, currentCat) => {
    const nextIdx = (CATEGORIES.indexOf(currentCat) + 1) % CATEGORIES.length;
    update({ tracks: tracks.map(t => t.id === trackId ? { ...t, category: CATEGORIES[nextIdx] } : t) });
  };

  // ── Moodboard ─────────────────────────────────────────────────────────────
  const [mbIdx,    setMbIdx]    = useState(0);
  const [mbFading, setMbFading] = useState(false);

  const switchMb = (idx) => {
    if (idx === mbIdx) return;
    setMbFading(true);
    setTimeout(() => { setMbIdx(idx); setMbFading(false); }, 180);
  };

  const addMoodboardImage = async () => {
    const r = await window.electronAPI.pickImage();
    if (!r) return;
    const next = [...moodboardImgs, r];
    update({ moodboardImages: next });
    setMbIdx(next.length - 1);
  };

  // ── Lyrics ────────────────────────────────────────────────────────────────
  const [editingLyricId, setEditingLyricId] = useState(null);
  const [newLyricTitle,  setNewLyricTitle]  = useState('');
  const [newLyricBpm,    setNewLyricBpm]    = useState('');
  const editingLyric = lyrics.find(l => l.id === editingLyricId) || null;

  const updateLyric = (id, changes) =>
    update({ lyrics: lyrics.map(l => l.id === id ? { ...l, ...changes } : l) });

  const addLyric = () => {
    if (!newLyricTitle.trim()) return;
    update({ lyrics: [...lyrics, { id: String(Date.now()), title: newLyricTitle.trim(), bpm: newLyricBpm, text: '', order: lyrics.length }] });
    setNewLyricTitle('');
    setNewLyricBpm('');
  };

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [editingMission,  setEditingMission]  = useState(false);
  const [missionDraft,    setMissionDraft]    = useState(missionStmt);
  const [newNoteText,     setNewNoteText]     = useState('');
  const [showNoteInput,   setShowNoteInput]   = useState(false);
  const [editingNoteId,   setEditingNoteId]   = useState(null);
  const [editNoteTitle,   setEditNoteTitle]   = useState('');
  const [editNoteText,    setEditNoteText]    = useState('');
  const projectNotes = notes.filter(n => n.projectId === project.id);

  const saveNote = () => {
    if (!newNoteText.trim()) return;
    onSaveNote({ text: newNoteText.trim(), projectId: project.id, topic: null });
    setNewNoteText('');
    setShowNoteInput(false);
  };

  const cancelNote = () => {
    setNewNoteText('');
    setShowNoteInput(false);
  };

  const startEditNote = (n) => {
    setEditingNoteId(n.id);
    setEditNoteTitle(n.title || '');
    setEditNoteText(typeof n.text === 'string' ? n.text : '');
  };

  const saveEditNote = () => {
    if (!editNoteText.trim()) return;
    onUpdateNote?.(editingNoteId, {
      title: editNoteTitle.trim() || null,
      text: editNoteText.trim(),
    });
    setEditingNoteId(null);
  };

  const cancelEditNote = () => setEditingNoteId(null);

  // ── Hero ──────────────────────────────────────────────────────────────────
  // Inline title editing
  const [editingHeroTitle, setEditingHeroTitle] = useState(false);
  const [heroNameDraft,    setHeroNameDraft]    = useState(project.name);
  useEffect(() => { if (!editingHeroTitle) setHeroNameDraft(project.name); }, [project.name, editingHeroTitle]);
  const commitHeroName = () => {
    const t = heroNameDraft.trim();
    if (t && t !== project.name) update({ name: t });
    setEditingHeroTitle(false);
  };

  // Inline subtitle editing
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [draftArtist,     setDraftArtist]     = useState(artistName);
  const [draftAlbum,      setDraftAlbum]      = useState(albumTitle);
  const commitSubtitle = () => {
    update({ artistName: draftArtist, albumTitle: draftAlbum });
    setEditingSubtitle(false);
  };

  // Hero task panel
  const [showAllHeroTasks,  setShowAllHeroTasks]  = useState(false);
  const [newHeroTaskText,   setNewHeroTaskText]   = useState('');
  const [editingHeroTaskId, setEditingHeroTaskId] = useState(null);
  const [heroTaskDraft,     setHeroTaskDraft]     = useState('');
  const heroDateRefs = useRef({});
  const heroTasks        = project.tasks || [];
  const visibleHeroTasks = showAllHeroTasks ? heroTasks : heroTasks.slice(0, 6);

  const toggleTask = (taskId) =>
    update({ tasks: heroTasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) });

  const updateHeroTask = (taskId, changes) =>
    update({ tasks: heroTasks.map(t => t.id === taskId ? { ...t, ...changes } : t) });

  const addHeroTask = () => {
    const text = newHeroTaskText.trim();
    if (!text) return;
    update({ tasks: [...heroTasks, { id: String(Date.now()), text, done: false, dueDate: null }] });
    setNewHeroTaskText('');
  };

  const startEditHeroTask = (id, text) => {
    setEditingHeroTaskId(id);
    setHeroTaskDraft(text);
  };

  const commitHeroTask = () => {
    const text = heroTaskDraft.trim();
    if (text && editingHeroTaskId) updateHeroTask(editingHeroTaskId, { text });
    setEditingHeroTaskId(null);
  };

  // Task popover (click task name in hero panel)
  const [heroPopoverTaskId,  setHeroPopoverTaskId]  = useState(null);
  const [popoverTitle,       setPopoverTitle]       = useState('');
  const [popoverNotes,       setPopoverNotes]       = useState('');
  const popoverTask = heroTasks.find(t => t.id === heroPopoverTaskId) || null;

  const openHeroPopover = (t) => {
    setHeroPopoverTaskId(t.id);
    setPopoverTitle(t.text);
    setPopoverNotes(t.notes || '');
  };
  const saveHeroPopover = () => {
    if (heroPopoverTaskId) {
      updateHeroTask(heroPopoverTaskId, {
        text: popoverTitle.trim() || popoverTask?.text,
        notes: popoverNotes,
      });
    }
    setHeroPopoverTaskId(null);
  };

  // ── Panel float state ─────────────────────────────────────────────────────
  const [musicFloat,  setMusicFloat]  = useState(false);
  const [mbFloat,     setMbFloat]     = useState(false);
  const [lyricsFloat, setLyricsFloat] = useState(false);
  const [notesFloat,  setNotesFloat]  = useState(false);
  const [seFloat,     setSeFloat]     = useState(false);

  // ── SE chat ───────────────────────────────────────────────────────────────
  const chatHistoryRef = useRef(project.chatHistory || []);
  useEffect(() => { chatHistoryRef.current = project.chatHistory || []; }, [project.chatHistory]);

  const getInitialMessages = () => {
    const hist = chatHistoryRef.current;
    if (hist.length > 0) return hist;
    const openTasks = (project.tasks || []).filter(t => !t.done).length;
    const lines = [
      `I'm up to speed on ${project.name}.`,
      '',
      `Status: ${STATUS_LABELS[project.status] || project.status}`,
      `Progress: ${project.progress || 0}%`,
      `Open tasks: ${openTasks}`,
      ...(missionStmt ? [``, `Mission: ${missionStmt}`] : []),
      '',
      `What are we working on today?`,
    ];
    return [{ role: 'assistant', content: lines.join('\n') }];
  };

  const handleSEMessages = (msgs) => {
    chatHistoryRef.current = msgs;
    update({ chatHistory: msgs });
  };

  // ── Drag-to-reorder ───────────────────────────────────────────────────────
  const dragIdx = useRef(null);
  const handleDragStart = (e, idx) => { dragIdx.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver  = (e) => e.preventDefault();

  const handleTrackDrop = (e, dropIdx) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) return;
    const next = [...tracks];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    update({ tracks: next });
    if (currentIdx === from) setCurrentIdx(dropIdx);
  };

  const handleLyricDrop = (e, dropIdx) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) return;
    const next = [...lyrics];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    update({ lyrics: next });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // All section renderers are called as PLAIN FUNCTIONS (not React components)
  // to avoid the unmount/remount cycle that breaks inputs and textarea focus.
  // ═══════════════════════════════════════════════════════════════════════════

  const musicContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Artwork area — fixed 200px, blurred background + centered square art */}
      <div className="pv-album-art-wrap">
        {albumArt ? (
          <>
            <div className="pv-album-blur-bg" style={{ backgroundImage: `url("${albumArt}")` }} />
            <div className="pv-album-artwork"    style={{ backgroundImage: `url("${albumArt}")` }} />
          </>
        ) : (
          <div className="pv-album-placeholder" />
        )}
        <div className="pv-album-art-overlay">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{albumTitle || project.name}</div>
          <div style={{ fontSize: 11, opacity: .7, marginBottom: 10 }}>
            {filteredTracks.length} track{filteredTracks.length !== 1 ? 's' : ''}
          </div>
          <button className="pv-swap-btn" onClick={async (e) => {
            e.stopPropagation();
            const r = await window.electronAPI.pickImage();
            if (r) update({ albumArt: r });
          }}>Swap cover</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="pv-filter-tabs">
        {['All', 'Demo', 'Finished', 'Reference'].map(f => (
          <button key={f} className={`pv-filter-tab${trackFilter === f ? ' active' : ''}`}
            onClick={() => { setTrackFilter(f); setCurrentIdx(0); }}>
            {f}
          </button>
        ))}
      </div>

      {/* Track list — scrolls internally */}
      <div className="pv-track-list">
        {filteredTracks.map((t, i) => (
          <div
            key={t.id}
            className={`pv-track-row${currentIdx === i && isPlaying ? ' playing' : ''}`}
            draggable
            onDragStart={e => handleDragStart(e, tracks.indexOf(t))}
            onDragOver={handleDragOver}
            onDrop={e => handleTrackDrop(e, tracks.indexOf(t))}
            onClick={() => playTrack(i)}
          >
            <span className="pv-drag-handle" title="Drag to reorder">⠿</span>
            <span className="pv-track-play">{currentIdx === i && isPlaying ? '⏸' : '▶'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pv-track-name" style={{ fontWeight: currentIdx === i ? 700 : 400 }}>{t.title}</div>
              <div className="pv-track-meta">
                {[t.bpm && `${t.bpm} BPM`, t.format?.toUpperCase(), t.date].filter(Boolean).join(' · ')}
              </div>
            </div>
            <span
              className="pv-cat-badge"
              style={{ background: CATEGORY_COLORS[t.category] || '#9e9e9c', cursor: 'pointer' }}
              title="Click to change type"
              onClick={e => { e.stopPropagation(); cycleTrackCategory(t.id, t.category); }}
            >{t.category}</span>
            <span className="pv-track-dur">{t.duration || '--'}</span>
            <button
              className="pv-track-del-btn"
              title="Remove track"
              onClick={e => { e.stopPropagation(); deleteTrack(t.id); }}
            >×</button>
          </div>
        ))}
        {filteredTracks.length === 0 && (
          <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            No tracks yet — click Add track below
          </div>
        )}
      </div>

      {/* Add track */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button className="pv-add-track-btn" onClick={addTrack}>+ Add track</button>
        {audioError && (
          <div style={{ fontSize: 11, color: 'var(--status-overdue)', marginTop: 4 }}>{audioError}</div>
        )}
      </div>

      {/* Player bar */}
      <div className="pv-player-bar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack?.title || 'No track selected'}
          </span>
          {currentTrack?.bpm && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>{currentTrack.bpm} BPM</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="pv-player-btn" onClick={() => skipTo(-1)}>⏮</button>
          <button className="pv-player-btn primary" onClick={() => setIsPlaying(p => !p)}>{isPlaying ? '⏸' : '▶'}</button>
          <button className="pv-player-btn" onClick={() => skipTo(1)}>⏭</button>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 30 }}>{fmtTime(audioTime)}</span>
          <input
            type="range" min={0} max={100}
            value={audioDuration ? (audioTime / audioDuration) * 100 : 0}
            onChange={e => scrub(+e.target.value)}
            className="pv-scrubber"
          />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>{fmtTime(audioDuration)}</span>
        </div>
      </div>
    </div>
  );

  const moodboardContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        className="pv-moodboard-main"
        style={{ backgroundImage: moodboardImgs[mbIdx] ? `url("${moodboardImgs[mbIdx]}")` : undefined, opacity: mbFading ? 0 : 1 }}
      >
        {moodboardImgs.length > 1 && (
          <>
            <button className="pv-mb-arrow pv-mb-arrow-left"
              onClick={() => switchMb((mbIdx - 1 + moodboardImgs.length) % moodboardImgs.length)}>‹</button>
            <button className="pv-mb-arrow pv-mb-arrow-right"
              onClick={() => switchMb((mbIdx + 1) % moodboardImgs.length)}>›</button>
          </>
        )}
        {moodboardImgs.length > 0 && (
          <span className="pv-mb-counter">{mbIdx + 1} / {moodboardImgs.length}</span>
        )}
        {moodboardImgs.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>
            Add images below
          </div>
        )}
      </div>
      <div className="pv-mb-thumbnails">
        {moodboardImgs.map((img, i) => (
          <div
            key={i}
            className={`pv-mb-thumb${i === mbIdx ? ' active' : ''}`}
            style={{ backgroundImage: `url("${img}")` }}
            onClick={() => switchMb(i)}
          />
        ))}
        <button className="pv-mb-thumb-add" title="Add image" onClick={addMoodboardImage}>+</button>
      </div>
    </div>
  );

  const lyricsContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="pv-panel-scroll">
        {lyrics.map((l, i) => (
          <div
            key={l.id}
            className="pv-lyric-row"
            draggable
            onDragStart={e => handleDragStart(e, i)}
            onDragOver={handleDragOver}
            onDrop={e => handleLyricDrop(e, i)}
            onClick={() => setEditingLyricId(l.id)}
          >
            <span className="pv-drag-handle">⠿</span>
            <span className="pv-lyric-title">{l.title}</span>
            {l.bpm && <span className="pv-lyric-bpm">{l.bpm} BPM</span>}
          </div>
        ))}
        {lyrics.length === 0 && (
          <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            No songs yet
          </div>
        )}
      </div>
      <div className="pv-new-lyric-form">
        <input
          className="pv-inline-input"
          placeholder="Song title…"
          value={newLyricTitle}
          onChange={e => setNewLyricTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addLyric()}
        />
        <input
          className="pv-inline-input pv-bpm-input"
          placeholder="BPM"
          value={newLyricBpm}
          onChange={e => setNewLyricBpm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addLyric()}
        />
        <button className="pv-inline-add-btn" onClick={addLyric}>Add</button>
      </div>
    </div>
  );

  const notesContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Mission statement */}
      <div className="pv-mission" onClick={() => { setMissionDraft(missionStmt); setEditingMission(true); }}>
        <div className="pv-mission-label">Mission statement</div>
        <div className="pv-mission-text">{missionStmt || 'Click to set your mission statement…'}</div>
      </div>

      {/* Note list */}
      <div className="pv-panel-scroll">
        {projectNotes.length === 0 && (
          <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)' }}>No notes for this project</div>
        )}
        {projectNotes.map(n => {
          const { title, body } = splitTitle(n);
          if (editingNoteId === n.id) {
            return (
              <div key={n.id} className="pv-note-edit-area">
                <input
                  className="pv-inline-input"
                  placeholder="Title (optional)"
                  value={editNoteTitle}
                  onChange={e => setEditNoteTitle(e.target.value)}
                />
                <textarea
                  className="pv-note-textarea"
                  value={editNoteText}
                  onChange={e => setEditNoteText(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="pv-inline-add-btn secondary" onClick={cancelEditNote}>Cancel</button>
                  <button className="pv-inline-add-btn" onClick={saveEditNote}>Save</button>
                </div>
              </div>
            );
          }
          return (
            <div key={n.id} className="pv-note-row" style={{ cursor: 'pointer' }} onClick={() => startEditNote(n)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pv-note-title">{title}</div>
                {body && <div className="pv-note-body">{body.slice(0, 80)}</div>}
              </div>
              {n.topic && <span className="note-tag">{n.topic}</span>}
              <button className="pv-edit-note-btn" title="Edit" onClick={e => { e.stopPropagation(); startEditNote(n); }}>✎</button>
              <button className="note-delete" onClick={e => { e.stopPropagation(); onDeleteNote(n.id); }}>×</button>
            </div>
          );
        })}
      </div>

      {/* New note area */}
      {showNoteInput ? (
        <div className="pv-new-note-area">
          <textarea
            className="pv-note-textarea"
            placeholder="Write a note…"
            value={newNoteText}
            onChange={e => setNewNoteText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="pv-inline-add-btn secondary" onClick={cancelNote}>Cancel</button>
            <button className="pv-inline-add-btn" onClick={saveNote}>Save</button>
          </div>
        </div>
      ) : (
        <button className="pv-add-note-btn" onClick={() => setShowNoteInput(true)}>+ Add note</button>
      )}
    </div>
  );

  const seContent = (seKey) => {
    if (!apiKey) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading session engineer…</span>
        </div>
      );
    }
    return (
      <ChatPanel
        key={seKey}
        apiKey={apiKey}
        initialMessages={getInitialMessages()}
        onMessagesChange={handleSEMessages}
        projectId={project.id}
        topics={topics}
        onSaveNote={onSaveNote}
      />
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="pv-screen">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={e => setAudioTime(e.target.currentTime)}
        onLoadedMetadata={e => { setAudioDuration(e.target.duration); setAudioError(''); }}
        onError={e => {
          const msg = e.target.error?.message || 'File could not be loaded';
          setAudioError(`Playback error: ${msg}`);
          setIsPlaying(false);
        }}
        onEnded={() => {
          if (filteredTracks.length > 1) { setCurrentIdx(i => (i + 1) % filteredTracks.length); setIsPlaying(true); }
          else setIsPlaying(false);
        }}
      />

      {/* ── Hero — 2/3 image left + 1/3 task panel right ── */}
      <div className="pv-hero" style={{ backgroundImage: project.moodImage ? `url("${project.moodImage}")` : undefined }}>
        <div className="pv-hero-gradient" />

        {/* Left area: title, subtitle, swap button */}
        <div className="pv-hero-left">
          <div className="pv-hero-content">
            {editingHeroTitle ? (
              <input
                className="pv-hero-name-input"
                value={heroNameDraft}
                onChange={e => setHeroNameDraft(e.target.value)}
                onBlur={commitHeroName}
                onKeyDown={e => { if (e.key === 'Enter') commitHeroName(); if (e.key === 'Escape') setEditingHeroTitle(false); }}
                autoFocus
              />
            ) : (
              <div className="pv-hero-name pv-hero-editable" onClick={() => setEditingHeroTitle(true)} title="Click to rename">
                {project.name}
              </div>
            )}

            {editingSubtitle ? (
              <div className="pv-hero-subtitle-form">
                <input className="pv-hero-sub-input" placeholder="Artist name" value={draftArtist} onChange={e => setDraftArtist(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitSubtitle()} />
                <span style={{ color: 'rgba(255,255,255,.45)' }}>·</span>
                <input className="pv-hero-sub-input" placeholder="Album / project" value={draftAlbum} onChange={e => setDraftAlbum(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitSubtitle()} />
                <button className="pv-hero-btn" onClick={commitSubtitle}>Save</button>
                <button className="pv-hero-btn" onClick={() => setEditingSubtitle(false)}>✕</button>
              </div>
            ) : (
              <div
                className="pv-hero-subtitle pv-hero-editable pv-hero-subtitle-editable"
                onClick={() => { setDraftArtist(artistName); setDraftAlbum(albumTitle); setEditingSubtitle(true); }}
                title="Click to edit"
              >
                {artistName || albumTitle
                  ? [artistName, albumTitle].filter(Boolean).join(' · ')
                  : 'Click to add artist · album'}
              </div>
            )}
          </div>
          <button className="pv-hero-swap-btn" onClick={async () => {
            const r = await window.electronAPI.pickImage();
            if (r) update({ moodImage: r });
          }}>Swap image</button>
        </div>

        {/* Right 1/3: task panel */}
        <div className="pv-hero-task-panel">
          <div className="pv-hero-tp-progress">
            <div className="pv-hero-tp-label">Progress — {project.progress || 0}%</div>
            <div className="pv-hero-tp-bar">
              <div className="pv-hero-tp-bar-fill" style={{ width: `${project.progress || 0}%` }} />
            </div>
          </div>

          <div className="pv-hero-tp-tasks">
            {heroTasks.length === 0 && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', paddingTop: 4 }}>No tasks — add one below</div>
            )}
            {visibleHeroTasks.map(t => (
              <div key={t.id} className="pv-hero-task-row">
                <input
                  type="checkbox" checked={!!t.done}
                  onChange={() => toggleTask(t.id)}
                  onClick={e => e.stopPropagation()}
                />
                <span
                  className="pv-hero-task-text"
                  style={{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.45 : 1 }}
                  onClick={e => { e.stopPropagation(); openHeroPopover(t); }}
                  title="Click to view / edit"
                >
                  {t.text}
                </span>
                {/* Hidden date input + visible date button */}
                <input
                  type="date"
                  ref={el => heroDateRefs.current[t.id] = el}
                  value={t.dueDate || ''}
                  style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }}
                  onChange={e => updateHeroTask(t.id, { dueDate: e.target.value || null })}
                />
                <button
                  className="pv-hero-task-date-btn"
                  title={t.dueDate ? `Due ${fmtShortDate(t.dueDate)} — click to change` : 'Set due date'}
                  onClick={e => {
                    e.stopPropagation();
                    const inp = heroDateRefs.current[t.id];
                    if (inp) { inp.style.pointerEvents = 'auto'; inp.showPicker?.(); inp.style.pointerEvents = 'none'; }
                  }}
                >
                  {t.dueDate ? fmtShortDate(t.dueDate) : '+'}
                </button>
              </div>
            ))}
          </div>

          {heroTasks.length > 6 && (
            <button className="pv-hero-tp-viewall" onClick={() => setShowAllHeroTasks(v => !v)}>
              {showAllHeroTasks ? 'Show less' : `View all ${heroTasks.length} tasks →`}
            </button>
          )}

          {/* Add task input */}
          <div className="pv-hero-tp-add">
            <input
              className="pv-hero-tp-add-input"
              placeholder="+ Add task…"
              value={newHeroTaskText}
              onChange={e => setNewHeroTaskText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHeroTask()}
            />
          </div>
        </div>
      </div>

      {/* ── Row 1: Music + Moodboard ── */}
      <div className="pv-two-col">
        {musicFloat ? (
          <>
            <FloatingPlaceholder label="Music" onReopen={() => setMusicFloat(false)} />
            <FloatingWindow title="Music" projectName={project.name} onClose={() => setMusicFloat(false)} defaultPos={{ x: 60, y: 100 }} width={420} height={620}>
              {musicContent()}
            </FloatingWindow>
          </>
        ) : (
          <div className="pv-card">
            <CardHeader title="Music" onExpand={() => setMusicFloat(true)} />
            {musicContent()}
          </div>
        )}

        {mbFloat ? (
          <>
            <FloatingPlaceholder label="Moodboard" onReopen={() => setMbFloat(false)} />
            <FloatingWindow title="Moodboard" projectName={project.name} onClose={() => setMbFloat(false)} defaultPos={{ x: 500, y: 100 }} width={420} height={520}>
              {moodboardContent()}
            </FloatingWindow>
          </>
        ) : (
          <div className="pv-card">
            <CardHeader title="Moodboard" onExpand={() => setMbFloat(true)} />
            {moodboardContent()}
          </div>
        )}
      </div>

      {/* ── Row 2: Lyrics + Notes + SE ── */}
      <div className="pv-three-col">
        {lyricsFloat ? (
          <>
            <FloatingPlaceholder label="Lyrics" onReopen={() => setLyricsFloat(false)} />
            <FloatingWindow title="Lyrics" projectName={project.name} onClose={() => setLyricsFloat(false)} defaultPos={{ x: 80, y: 120 }} width={400} height={500}>
              {lyricsContent()}
            </FloatingWindow>
          </>
        ) : (
          <div className="pv-card">
            <CardHeader title="Lyrics" onExpand={() => setLyricsFloat(true)} />
            {lyricsContent()}
          </div>
        )}

        {notesFloat ? (
          <>
            <FloatingPlaceholder label="Notes" onReopen={() => setNotesFloat(false)} />
            <FloatingWindow title="Notes" projectName={project.name} onClose={() => setNotesFloat(false)} defaultPos={{ x: 480, y: 120 }} width={400} height={500}>
              {notesContent()}
            </FloatingWindow>
          </>
        ) : (
          <div className="pv-card">
            <CardHeader title="Notes" onExpand={() => setNotesFloat(true)}>
              <button className="pv-card-btn" onClick={() => setShowNoteInput(true)}>+</button>
            </CardHeader>
            {notesContent()}
          </div>
        )}

        {seFloat ? (
          <>
            <FloatingPlaceholder label="Session Engineer" onReopen={() => setSeFloat(false)} />
            <FloatingWindow title="Session Engineer" projectName={project.name} onClose={() => setSeFloat(false)} defaultPos={{ x: 880, y: 120 }} width={460} height={580}>
              {seContent(`${project.id}-float`)}
            </FloatingWindow>
          </>
        ) : (
          <div className="pv-card">
            <CardHeader title="Session Engineer" onExpand={() => setSeFloat(true)} />
            {seContent(`${project.id}-inline`)}
          </div>
        )}
      </div>

      {/* ── Lyrics editor modal ── */}
      {editingLyricId && editingLyric && (
        <div className="pv-lyrics-editor" onClick={e => { if (e.target === e.currentTarget) setEditingLyricId(null); }}>
          <div className="pv-lyrics-editor-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <input
                className="pv-lyrics-title-input"
                value={editingLyric.title}
                onChange={e => updateLyric(editingLyric.id, { title: e.target.value })}
                placeholder="Song title"
              />
              <input
                className="pv-lyrics-bpm-input"
                value={editingLyric.bpm}
                onChange={e => updateLyric(editingLyric.id, { bpm: e.target.value })}
                placeholder="BPM"
              />
              <button className="pv-expand-btn" style={{ marginLeft: 'auto' }} onClick={() => setEditingLyricId(null)}>×</button>
            </div>
            <textarea
              className="pv-lyrics-textarea"
              placeholder="Write lyrics…"
              value={editingLyric.text}
              onChange={e => updateLyric(editingLyric.id, { text: e.target.value })}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
              <button className="pv-inline-add-btn secondary" onClick={() => {
                if (window.confirm('Delete this song?')) {
                  update({ lyrics: lyrics.filter(l => l.id !== editingLyric.id) });
                  setEditingLyricId(null);
                }
              }}>Delete song</button>
              <button className="pv-inline-add-btn" onClick={() => setEditingLyricId(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mission statement modal ── */}
      {editingMission && (
        <div className="pv-lyrics-editor" onClick={e => { if (e.target === e.currentTarget) setEditingMission(false); }}>
          <div className="pv-lyrics-editor-inner" style={{ height: 'auto', maxHeight: '60vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Mission Statement</span>
              <button className="pv-expand-btn" onClick={() => setEditingMission(false)}>×</button>
            </div>
            <textarea
              className="pv-lyrics-textarea"
              style={{ minHeight: 120, flex: 'none' }}
              placeholder="Describe the vision, feel, and goal of this project…"
              value={missionDraft}
              onChange={e => setMissionDraft(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button className="pv-inline-add-btn" onClick={() => { update({ missionStatement: missionDraft }); setEditingMission(false); }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Track type selection modal ── */}
      {pendingTrack && (
        <div className="task-modal-backdrop">
          <div className="task-modal" style={{ width: 340, gap: 14 }}>
            <div className="task-modal-header">
              <span style={{ fontSize: 14, fontWeight: 700 }}>Track type</span>
              <button className="task-modal-close" onClick={() => setPendingTrack(null)}>×</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pendingTrack.name}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => confirmAddTrack(cat)}
                  style={{
                    flex: 1, background: CATEGORY_COLORS[cat] || '#9e9e9c', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 0',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                  }}
                >{cat}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Hero task popover ── */}
      {heroPopoverTaskId && popoverTask && (
        <div className="pv-task-popover-wrap" onClick={() => setHeroPopoverTaskId(null)}>
          <div className="pv-task-popover" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="task-modal-project-tag">{project.name}</span>
              <button className="task-modal-close" onClick={saveHeroPopover}>×</button>
            </div>
            <input
              className="pv-task-popover-title"
              value={popoverTitle}
              onChange={e => setPopoverTitle(e.target.value)}
              placeholder="Task title"
              onKeyDown={e => e.key === 'Enter' && saveHeroPopover()}
              autoFocus
            />
            {popoverTask.dueDate && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Due {fmtShortDate(popoverTask.dueDate)}
              </div>
            )}
            <textarea
              className="pv-task-popover-notes"
              placeholder="Add notes or description…"
              value={popoverNotes}
              onChange={e => setPopoverNotes(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
              <button className="pv-inline-add-btn secondary" onClick={() => setHeroPopoverTaskId(null)}>Cancel</button>
              <button className="pv-inline-add-btn" onClick={saveHeroPopover}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
