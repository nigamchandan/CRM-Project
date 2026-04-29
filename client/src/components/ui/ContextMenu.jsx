import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

/* ---------------------------------------------------------------------------
 *  ContextMenu — controlled floating menu used for right-click actions on
 *  table rows.  The parent owns the state ({ x, y, payload } | null) and
 *  passes a list of actions; this component handles positioning, outside-
 *  click dismissal and Esc.
 * ----------------------------------------------------------------------- */

export default function ContextMenu({ at, onClose, items }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!at) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onKey  = (e) => { if (e.key === 'Escape') onClose?.(); };
    // onMouseDown captures the *next* click; running on next tick avoids
    // closing on the same right-click that opened us.
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [at, onClose]);

  if (!at) return null;

  // Keep the menu inside the viewport — flip to the left/above edges if needed.
  const W = 220, H = Math.min(items.length * 36 + 16, 360);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = at.x + W + 8 > vw ? Math.max(8, vw - W - 8) : at.x;
  const top  = at.y + H + 8 > vh ? Math.max(8, vh - H - 8) : at.y;

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left, top, width: W }}
      className="fixed z-50 rounded-xl border border-gray-200 dark:border-slate-700/80
                 bg-white dark:bg-[#10131c] shadow-card-hover py-1
                 animate-slide-up"
    >
      {items.map((it, i) => {
        if (it.divider) {
          return <div key={`div-${i}`} className="my-1 h-px bg-gray-100 dark:bg-slate-800" />;
        }
        const danger = it.tone === 'danger';
        return (
          <button
            key={it.id || it.label}
            disabled={it.disabled}
            onClick={(e) => { e.stopPropagation(); if (!it.disabled) { onClose?.(); it.onClick?.(e); } }}
            className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2.5 transition
                        ${it.disabled
                          ? 'text-gray-400 dark:text-slate-600 cursor-not-allowed'
                          : danger
                            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                            : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
            role="menuitem"
          >
            {it.icon && <Icon name={it.icon} className="w-4 h-4 opacity-70" />}
            <span className="flex-1 truncate">{it.label}</span>
            {it.suffix && <span className="text-[11px] text-gray-400 dark:text-slate-500">{it.suffix}</span>}
          </button>
        );
      })}
    </div>
  );
}
