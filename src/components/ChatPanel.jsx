import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import Message from './Message';

const SpeechRecognitionAPI =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const VOICE_ID = 'WtA85syCrJwasGeHGH2p';
const MODEL_ID = 'eleven_turbo_v2';

const ChatPanel = forwardRef(function ChatPanel(
  { apiKey, initialMessages, onSaveNote, onMessagesChange, projectId, topics },
  ref
) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingScreenshot, setPendingScreenshot] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const messagesRef = useRef(messages);
  const pendingScreenshotRef = useRef(pendingScreenshot);
  const audioRef = useRef(null);

  // All TTS streaming state in one ref — avoids stale-closure issues in callbacks
  const ttsRef = useRef({
    ws: null, ms: null, sb: null, audio: null,
    textBuf: '', sendQueue: [], audioQueue: [], updating: false,
    eosReady: false, pendingEos: false, enabled: false, key: '',
  });

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { pendingScreenshotRef.current = pendingScreenshot; }, [pendingScreenshot]);
  useEffect(() => {
    window.electronAPI.getElevenLabsKey().then(k => { ttsRef.current.key = k; });
  }, []);
  useEffect(() => { ttsRef.current.enabled = ttsEnabled; }, [ttsEnabled]);

  // Sync completed conversations back to parent for persistence
  useEffect(() => {
    if (!isLoading && messages.length > 0) onMessagesChange?.(messages);
  }, [isLoading]);

  // Imperative handle — populated after all functions are defined below
  const imperativeRef = useRef({});
  useImperativeHandle(ref, () => imperativeRef.current);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── TTS helpers ───────────────────────────────────────────────────────────────

  // Drain the audio queue into the SourceBuffer one chunk at a time
  const ttsDrain = () => {
    const t = ttsRef.current;
    if (t.updating || !t.sb || t.ms?.readyState !== 'open') return;
    if (t.audioQueue.length === 0) {
      if (t.eosReady) {
        try { t.ms.endOfStream(); } catch (_) {}
        t.eosReady = false;
      }
      return;
    }
    const chunk = t.audioQueue.shift();
    try { t.sb.appendBuffer(chunk); t.updating = true; } catch (_) {}
  };

  const ttsStop = () => {
    const t = ttsRef.current;
    try { t.ws?.close(); } catch (_) {}
    if (t.audio) t.audio.pause();
    Object.assign(t, {
      ws: null, ms: null, sb: null, audio: null,
      textBuf: '', sendQueue: [], audioQueue: [],
      updating: false, eosReady: false, pendingEos: false,
    });
    audioRef.current = null;
  };

  // Send everything in sendQueue over an open WebSocket, then EOS if pending
  const ttsFlushSendQueue = () => {
    const t = ttsRef.current;
    if (!t.ws || t.ws.readyState !== WebSocket.OPEN) return;
    while (t.sendQueue.length > 0) {
      t.ws.send(JSON.stringify({ text: t.sendQueue.shift() }));
    }
    if (t.pendingEos) {
      t.pendingEos = false;
      t.ws.send(JSON.stringify({ text: '' }));
    }
  };

  // Open a WebSocket to ElevenLabs and wire up MediaSource playback
  const ttsInit = () => {
    const t = ttsRef.current;
    if (t.ws) return;

    const ms = new MediaSource();
    t.ms = ms;
    const srcUrl = URL.createObjectURL(ms);
    const audio = new Audio(srcUrl);
    t.audio = audio;
    audioRef.current = audio;
    audio.onended = () => { t.audio = null; audioRef.current = null; };

    audio.addEventListener('canplay', () => {
      audio.play().catch(_ => {});
    }, { once: true });

    ms.addEventListener('sourceopen', () => {
      URL.revokeObjectURL(srcUrl);
      try {
        const sb = ms.addSourceBuffer('audio/mpeg');
        t.sb = sb;
        sb.addEventListener('updateend', () => { t.updating = false; ttsDrain(); });
      } catch (e) { setError('TTS init failed: ' + e.message); return; }
      ttsDrain();
    }, { once: true });

    const ws = new WebSocket(
      `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input` +
      `?model_id=${MODEL_ID}&output_format=mp3_44100_128`
    );
    t.ws = ws;

    ws.onopen = () => {
      // BOS must be the first message — API key goes here, not in the URL
      ws.send(JSON.stringify({ text: ' ', xi_api_key: t.key, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }));
      // Flush any text that accumulated while the connection was opening
      ttsFlushSendQueue();
    };
    ws.onmessage = ({ data: raw }) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.error) { setError('TTS error: ' + (msg.error.message || JSON.stringify(msg.error))); return; }
        if (msg.audio) {
          const bytes = Uint8Array.from(atob(msg.audio), c => c.charCodeAt(0));
          t.audioQueue.push(bytes.buffer);
          ttsDrain();
        }
        if (msg.isFinal) { t.eosReady = true; ttsDrain(); }
      } catch (_) {}
    };
    ws.onerror = (e) => setError('TTS WebSocket error: ' + (e.message || 'connection failed'));
    ws.onclose = (e) => {
      if (t.ws === ws) t.ws = null;
      if (e.code !== 1000 && e.code !== 1001) setError(`TTS closed (${e.code}): ${e.reason || 'unknown'}`);
    };
  };

  // Called for each streaming text chunk from Claude
  const ttsReceiveChunk = (text) => {
    const t = ttsRef.current;
    if (!t.enabled) return;
    if (!t.ws) ttsInit();

    // Strip markdown, accumulate, flush on sentence boundaries or ~200 chars
    const clean = text.replace(/[*#`_~[\]()>]/g, '');
    t.textBuf += clean;
    const m = t.textBuf.match(/^([\s\S]*?[.!?:]\s)/);
    if (m || t.textBuf.length > 200) {
      const chunk = m ? m[1] : t.textBuf;
      t.textBuf = m ? t.textBuf.slice(m[1].length) : '';
      t.sendQueue.push(chunk);
      ttsFlushSendQueue(); // no-op if WebSocket not open yet; onopen will flush
    }
  };

  // Called when Claude finishes — flush remaining text and send EOS
  const ttsFinalize = () => {
    const t = ttsRef.current;
    if (!t.enabled || !t.ws) return;
    if (t.textBuf.trim()) { t.sendQueue.push(t.textBuf); t.textBuf = ''; }
    t.pendingEos = true;
    // Small delay ensures last text chunk is received by ElevenLabs before EOS
    setTimeout(ttsFlushSendQueue, 50);
  };

  // ── Streaming handler ─────────────────────────────────────────────────────────

  useEffect(() => {
    window.electronAPI.onMessageChunk((data) => {
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        ttsStop();
        return;
      }
      if (data.done) {
        setIsLoading(false);
        ttsFinalize();
        return;
      }
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last?.streaming) {
          return [...prev.slice(0, -1), { ...last, content: last.content + data.text }];
        }
        return [...prev, { role: 'assistant', content: data.text, streaming: true }];
      });
      ttsReceiveChunk(data.text);
    });
    return () => window.electronAPI.removeMessageChunkListeners();
  }, []);

  // Clear streaming flag on completion
  useEffect(() => {
    if (!isLoading) {
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    }
  }, [isLoading]);

  const sendMessage = useCallback((text, screenshot) => {
    const trimmed = (text || '').trim();
    if (!trimmed && !screenshot) return;
    if (!apiKey) {
      setError('No API key. Add ANTHROPIC_API_KEY to your .env file and restart.');
      return;
    }
    if (isLoading) return;

    ttsStop();
    setError('');

    let userContent;
    if (screenshot) {
      const b64 = screenshot.replace('data:image/png;base64,', '');
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
        { type: 'text', text: trimmed || 'What do you see in my Ableton session? Any feedback?' },
      ];
    } else {
      userContent = trimmed;
    }

    const userMsg = {
      role: 'user',
      content: userContent,
      displayText: trimmed || '📸 Screenshot attached',
      hasScreenshot: !!screenshot,
    };

    const currentMessages = messagesRef.current;
    const apiMessages = [...currentMessages, { role: 'user', content: userContent }].map(m => ({
      role: m.role,
      content: m.content,
    }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingScreenshot(null);
    setIsLoading(true);

    window.electronAPI.sendMessage({ messages: apiMessages, apiKey });
  }, [apiKey, isLoading]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    sendMessage(input, pendingScreenshot);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCaptureScreen = async () => {
    const shot = await window.electronAPI.captureScreen();
    if (shot) {
      setPendingScreenshot(shot);
    } else {
      setError('Screen capture failed. Grant Screen Recording permission in System Preferences > Privacy & Security.');
    }
  };

  const startListening = () => {
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not available in this environment.');
      return;
    }
    transcriptRef.current = '';
    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      transcriptRef.current = transcript;
      setInput(transcript);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const stopListeningAndSend = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    const text = transcriptRef.current;
    transcriptRef.current = '';
    if (text.trim()) {
      setInput('');
      sendMessage(text, pendingScreenshotRef.current);
    }
  };

  // Populate imperative handle now that all functions exist
  imperativeRef.current = {
    startVoice: startListening,
    stopVoice: stopListeningAndSend,
    triggerCapture: handleCaptureScreen,
    sendQuickAsk: (text) => sendMessage(text, null),
  };

  const canSend = (input.trim() || pendingScreenshot) && !isLoading;

  return (
    <div className="chat-panel">
      {!apiKey && (
        <div className="warning-bar">
          Add <code>ANTHROPIC_API_KEY</code> to a <code>.env</code> file in the app folder, then restart.
        </div>
      )}

      <div className="messages-area">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-title">Session Engineer Online</div>
            <div className="empty-sub">
              Ask about your mix, share a screenshot of your session,<br />
              or hold the mic button to speak.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message
            key={i}
            message={msg}
            topics={topics}
            onSave={payload => onSaveNote?.({ ...payload, projectId })}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {pendingScreenshot && (
        <div className="screenshot-preview">
          <img src={pendingScreenshot} alt="Screen capture preview" />
          <div className="screenshot-overlay">
            <span>Screenshot ready</span>
            <button onClick={() => setPendingScreenshot(null)}>Remove</button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <form className="input-area" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`btn-icon ${isListening ? 'btn-listening' : ''}`}
          onMouseDown={startListening}
          onMouseUp={stopListeningAndSend}
          onMouseLeave={stopListeningAndSend}
          title="Hold to speak"
        >
          {isListening ? '●' : '⏺'}
        </button>

        <button
          type="button"
          className={`btn-icon ${pendingScreenshot ? 'btn-active' : ''}`}
          onClick={handleCaptureScreen}
          title="Capture screen"
          disabled={isLoading}
        >
          ⊞
        </button>

        <input
          className="text-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening…' : 'Ask anything about your mix…'}
          disabled={isLoading}
        />

        <button
          type="button"
          className={`btn-icon ${ttsEnabled ? 'btn-active' : ''}`}
          onClick={() => {
            setTtsEnabled(v => !v);
            if (ttsEnabled) ttsStop();
          }}
          title={ttsEnabled ? 'Mute voice responses' : 'Enable voice responses'}
        >
          {ttsEnabled ? '🔊' : '🔇'}
        </button>

        <button
          type="submit"
          className="btn-send"
          disabled={!canSend}
        >
          {isLoading ? <span className="loading-dots" /> : '↑'}
        </button>
      </form>
    </div>
  );
});

export default ChatPanel;
