import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import * as ticketsService from '../../services/ticketsService';
import usePopoverDismiss from '../../hooks/usePopoverDismiss.js';

const PRIORITY_LABEL = { critical: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_DOT   = {
  critical: 'bg-red-500', high: 'bg-orange-500',
  medium:   'bg-amber-400', low: 'bg-gray-400',
};
const ORDER = ['critical', 'high', 'medium', 'low'];

/**
 * Inline priority editor — a compact pill that opens a 4-option popover.
 * `readOnly` collapses to a static pill (used for engineer / customer roles).
 */
export default function InlinePriority({ ticket, onChange, readOnly = false }) {
  const [open, setOpen]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const [current, setCurrent] = useState(ticket.priority || 'medium');
  const ref = useRef(null);
  usePopoverDismiss(open, ref, () => setOpen(false));

  // Sync local state with parent updates (e.g. value changed via right-click
  // menu or another tab) so the chip never falls out of sync after reload.
  useEffect(() => { setCurrent(ticket.priority || 'medium'); }, [ticket.priority]);

  const dot = PRIORITY_DOT[current] || 'bg-gray-400';
  const label = PRIORITY_LABEL[current] || current;

  const pick = async (p) => {
    if (p === current) { setOpen(false); return; }
    const previous = current;
    setCurrent(p);            // optimistic
    setBusy(true);
    try {
      await ticketsService.update(ticket.id, { priority: p });
      toast.success(`Priority → ${PRIORITY_LABEL[p]}`);
      onChange?.();
    } catch (err) {
      setCurrent(previous);   // rollback
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {label}
      </span>
    );
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md
                    border border-transparent hover:border-gray-300 dark:hover:border-slate-700
                    hover:bg-gray-50 dark:hover:bg-slate-800/60 transition
                    ${busy ? 'opacity-60 cursor-wait' : ''}`}
        title="Change priority"
      >
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {label}
        <span className="text-gray-400 text-[9px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-36 z-30 rounded-lg border border-gray-200 dark:border-slate-700
                        bg-white dark:bg-slate-900 shadow-lg py-1">
          {ORDER.map((p) => (
            <button
              key={p}
              onClick={() => pick(p)}
              className={`w-full px-3 py-1.5 text-xs flex items-center gap-2 text-left transition
                          ${p === current
                            ? 'bg-brand-50 dark:bg-brand-500/10 text-gray-900 dark:text-slate-100'
                            : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
            >
              <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[p]}`} />
              {PRIORITY_LABEL[p]}
              {p === current && <span className="ml-auto text-brand-500 dark:text-brand-300">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
