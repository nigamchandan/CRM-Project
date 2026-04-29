import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import * as ticketsService from '../../services/ticketsService';
import * as workloadService from '../../services/workloadService';
import usePopoverDismiss from '../../hooks/usePopoverDismiss.js';
import Icon from '../ui/Icon.jsx';

/**
 * Inline ticket-owner editor.  Opens a searchable popover with all assignable
 * users (engineers / managers / admins) and a "Suggest least loaded" shortcut
 * that fills in the lowest-loaded engineer in one click.  Read-only mode
 * collapses to plain text for roles that can't reassign.
 */
export default function InlineOwner({ ticket, users = [], onChange, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ]       = useState('');
  const [current, setCurrent] = useState({
    id:   ticket.engineer_id   || null,
    name: ticket.engineer_name || null,
  });
  const ref = useRef(null);
  usePopoverDismiss(open, ref, () => { setOpen(false); setQ(''); });

  // Keep the displayed owner in sync with parent updates (right-click assign,
  // socket events, manual reload) so the cell never stales between writes.
  useEffect(() => {
    setCurrent({
      id:   ticket.engineer_id   || null,
      name: ticket.engineer_name || null,
    });
  }, [ticket.engineer_id, ticket.engineer_name]);

  const assignable = useMemo(
    () => (users || []).filter((u) => ['engineer', 'manager', 'admin'].includes(u.role)),
    [users]
  );
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return assignable;
    return assignable.filter((u) =>
      String(u.name || '').toLowerCase().includes(k) ||
      String(u.email || '').toLowerCase().includes(k));
  }, [assignable, q]);

  if (readOnly) {
    return current.name
      ? <span className="text-gray-700 dark:text-slate-300">{current.name}</span>
      : <span className="text-gray-400">Unassigned</span>;
  }

  const apply = async (user) => {
    const prev = current;
    setCurrent({ id: user?.id ?? null, name: user?.name ?? null });
    setBusy(true);
    try {
      await ticketsService.assign(ticket.id, { user_id: user?.id ?? null });
      toast.success(user ? `Assigned to ${user.name}` : 'Unassigned');
      onChange?.();
    } catch (err) {
      setCurrent(prev);
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setBusy(false);
      setOpen(false);
      setQ('');
    }
  };

  const suggest = async () => {
    setBusy(true);
    try {
      const r = await workloadService.suggest({ exclude_id: current.id || undefined });
      const u = r?.user;
      if (!u) { toast.error('No engineer available'); return; }
      await apply(u);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Suggest failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={`text-left px-2 py-0.5 rounded-md border border-transparent
                    hover:border-gray-300 dark:hover:border-slate-700
                    hover:bg-gray-50 dark:hover:bg-slate-800/60 transition
                    ${busy ? 'opacity-60 cursor-wait' : ''}`}
        title="Change owner"
      >
        {current.name ? (
          <span className="text-gray-700 dark:text-slate-300">{current.name}</span>
        ) : (
          <span className="text-gray-400">Unassigned</span>
        )}
        <span className="ml-1 text-gray-400 text-[9px]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-64 z-30 rounded-lg border border-gray-200 dark:border-slate-700
                        bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-slate-800">
            <div className="relative">
              <Icon name="search" className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search engineers…"
                className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-700
                           bg-white dark:bg-slate-900 dark:text-slate-100
                           focus:outline-none focus:ring-2 focus:ring-brand-300/40"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            <button
              onClick={() => apply(null)}
              className="w-full px-3 py-1.5 text-xs text-left text-gray-600 dark:text-slate-400
                         hover:bg-gray-50 dark:hover:bg-slate-800/60 flex items-center gap-2"
            >
              <Icon name="x" className="w-3 h-3" />
              Unassigned
            </button>
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-gray-400 dark:text-slate-500">No matches</div>
            )}
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => apply(u)}
                className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 transition
                            ${u.id === current.id
                              ? 'bg-brand-50 dark:bg-brand-500/10 text-gray-900 dark:text-slate-100'
                              : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
              >
                <span className="w-5 h-5 rounded-full bg-brand-gradient-r text-white inline-flex items-center justify-center text-[10px] font-semibold">
                  {(u.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 truncate">{u.name}</span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">{u.role}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 p-2">
            <button
              onClick={suggest}
              disabled={busy}
              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-slate-700
                         bg-gray-50 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-700/60
                         text-gray-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5
                         disabled:opacity-60"
            >
              <Icon name="sparkles" className="w-3.5 h-3.5" />
              Suggest least-loaded
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
