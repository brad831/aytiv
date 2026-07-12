import React, { useState, useEffect, useCallback } from 'react';

export default function DevLogPanel() {
  const [log, setLog]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await window.electronAPI.getConversationLog();
      setLog(rows);
    } catch (e) {
      console.error('[DevLogPanel]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = iso => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div className="dev-log-panel">
      <div className="dev-log-header">
        <span className="dev-log-badge">DEV</span>
        <span className="dev-log-title">Conversation Log</span>
        <span className="dev-log-count">{log.length} entries</span>
        <button className="dev-log-refresh" onClick={load} disabled={loading}>
          {loading ? '…' : '↻'}
        </button>
      </div>

      {log.length === 0 && !loading && (
        <p className="dev-log-empty">No entries yet. SMS conversations will appear here once A2P is approved.</p>
      )}

      <div className="dev-log-list">
        {log.map(row => (
          <div
            key={row.id}
            className={`dev-log-row ${!row.supabase_write_success ? 'dev-log-row--error' : ''}`}
            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
          >
            <div className="dev-log-row-summary">
              <span className="dev-log-phone">{row.phone_number || '—'}</span>
              <span className="dev-log-time">{fmt(row.created_at)}</span>
              {row.detected_state && (
                <span className="dev-log-tag">{row.detected_state}</span>
              )}
              {row.detected_lane && (
                <span className="dev-log-tag dev-log-tag--lane">{row.detected_lane}</span>
              )}
              {!row.supabase_write_success && (
                <span className="dev-log-tag dev-log-tag--error">write failed</span>
              )}
            </div>

            {expanded === row.id && (
              <div className="dev-log-detail">
                <div className="dev-log-field">
                  <span className="dev-log-label">Input</span>
                  <span className="dev-log-value">{row.raw_input || '—'}</span>
                </div>
                <div className="dev-log-field">
                  <span className="dev-log-label">Response</span>
                  <span className="dev-log-value">{row.ai_response || '—'}</span>
                </div>
                {row.error && (
                  <div className="dev-log-field">
                    <span className="dev-log-label">Error</span>
                    <span className="dev-log-value dev-log-value--error">{row.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
