import React, { useState, useEffect, useRef } from 'react';

export default function FloatingWindow({ title, projectName, children, onClose, defaultPos, width, height }) {
  const [pos, setPos] = useState(defaultPos || { x: 120, y: 90 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onTitlebarDown = (e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  return (
    <div
      className="fw-root"
      style={{ left: pos.x, top: pos.y, width: width || 540 }}
    >
      <div className="fw-titlebar" onMouseDown={onTitlebarDown}>
        <div className="fw-title-info">
          <span className="fw-title">{title}</span>
          {projectName && <span className="fw-project-tag">{projectName}</span>}
        </div>
        <button className="fw-close" onClick={onClose}>×</button>
      </div>
      <div className="fw-body" style={{ height: height || 560 }}>
        {children}
      </div>
    </div>
  );
}
