/* QuickActionsBar — incident-command toolbar for the ticket detail page.
 *
 * Four primary actions, role-gated:
 *
 *    [ Assign engineer ]   admin / manager only      — opens least-loaded picker
 *    [ Change priority ]   admin / manager / owner   — popover with 4 levels
 *    [ Escalate ]          admin / manager           — bumps escalation_level
 *    [ Close ticket ]      anyone with edit access   — sets status='closed'
 *
 * Everything is optimistic-via-toast: backend errors roll back via the
 * parent's `onChange()` callback (reloads the ticket from the server).
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import * as ticketsService from '../../services/ticketsService';
import * as workloadService from '../../services/workloadService';
import Icon from '../ui/Icon.jsx';
import { useAuth } from '../../context/AuthContext';

const PRIORITIES = [
  { value: 'low',      label: 'Low',     dot: 'bg-gray-400'   },
  { value: 'medium',   label: 'Medium',  dot: 'bg-amber-400'  },
  { value: 'high',     label: 'High',    dot: 'bg-orange-500' },
  { value: 'critical', label: 'Urgent',  dot: 'bg-red-500'    },
];

export default function QuickActionsBar({ ticket, users = [], onChange }) {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin   = role === 'admin';
  const isManager = role === 'manager';
  const canAssign = isAdmin || isManager;
  const canEsc    = isAdmin || isManager;
  const isClosed  = ticket?.status === 'closed' || ticket?.status === 'resolved';

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [busyAction,   setBusyAction]   = useState(null);

  const wrap = async (key, fn, msg) => {
    setBusyAction(key);
    try {
      await fn();
      if (msg) toast.success(msg);
      onChange?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const setPriority = (p) =>
    wrap('priority', () => ticketsService.update(ticket.id, { priority: p }), `Priority → ${p}`);

  const escalate = () =>
    wrap('escalate', () => ticketsService.escalate(ticket.id), 'Escalated');

  const closeTicket = () =>
    wrap('close', () => ticketsService.setStatus(ticket.id, 'closed'), 'Ticket closed');

  const assignTo = (userId) =>
    wrap('assign',
         () => ticketsService.assign(ticket.id, { assigned_engineer_id: userId, user_id: userId }),
         userId ? 'Assigned' : 'Unassigned');

  const autoAssign = () =>
    wrap('autoassign', async () => {
      const r = await workloadService.suggest({ exclude_id: ticket.assigned_engineer_id });
      if (!r?.user) throw new Error('No engineer available');
      await ticketsService.assign(ticket.id, { assigned_engineer_id: r.user.id, user_id: r.user.id });
      toast.success(`Assigned to ${r.user.name} (load ${(r.user.load_score ?? 0).toFixed?.(1) ?? '0'})`);
    });

  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400 mb-2">
        Quick actions
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Assign */}
        {canAssign && (
          <ActionButton
            icon="userCircle"
            label="Assign"
            disabled={busyAction === 'assign' || busyAction === 'autoassign' || isClosed}
            onClick={() => setAssignOpen((v) => !v)}
            popover={assignOpen && (
              <AssignPopover
                users={users}
                currentId={ticket.assigned_engineer_id || ticket.assigned_to}
                onPick={(id) => { setAssignOpen(false); assignTo(id); }}
                onAuto={() => { setAssignOpen(false); autoAssign(); }}
                onClose={() => setAssignOpen(false)}
              />
            )}
          />
        )}

        {/* Priority */}
        <ActionButton
          icon="spark"
          label="Priority"
          disabled={busyAction === 'priority' || isClosed}
          onClick={() => setPriorityOpen((v) => !v)}
          popover={priorityOpen && (
            <PriorityPopover
              current={ticket.priority}
              onPick={(p) => { setPriorityOpen(false); setPriority(p); }}
              onClose={() => setPriorityOpen(false)}
            />
          )}
        />

        {/* Escalate */}
        {canEsc && (
          <ActionButton
            icon="bell"
            label={ticket.escalation_level > 0 ? `Escalate (L${ticket.escalation_level + 1})` : 'Escalate'}
            tone="rose"
            disabled={busyAction === 'escalate' || isClosed}
            onClick={escalate}
          />
        )}

        {/* Close */}
        <ActionButton
          icon="checkCircle"
          label={isClosed ? 'Closed' : 'Close ticket'}
          tone="emerald"
          disabled={isClosed || busyAction === 'close'}
          onClick={closeTicket}
        />
      </div>
    </div>
  );
}

/* ---------- presentational bits ---------- */

function ActionButton({ icon, label, onClick, disabled, tone = 'brand', popover }) {
  const tones = {
    brand:   'border-gray-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50/60 dark:hover:bg-brand-500/10 text-gray-700 dark:text-slate-200',
    rose:    'border-rose-200/70 dark:border-rose-500/30 hover:border-rose-300 hover:bg-rose-50/70 dark:hover:bg-rose-500/10 text-rose-700 dark:text-rose-300',
    emerald: 'border-emerald-200/70 dark:border-emerald-500/30 hover:border-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold border transition
                    disabled:opacity-50 disabled:cursor-not-allowed ${tones[tone] || tones.brand}`}
      >
        <Icon name={icon} className="w-3.5 h-3.5" />
        {label}
      </button>
      {popover}
    </div>
  );
}

function PriorityPopover({ current, onPick, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-lg border border-gray-200 dark:border-slate-700
                      bg-white dark:bg-[#1a1a26] shadow-xl p-1 min-w-[140px]">
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            onClick={() => onPick(p.value)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left
                        hover:bg-brand-50 dark:hover:bg-brand-500/10 transition
                        ${current === p.value ? 'bg-brand-50/60 dark:bg-brand-500/10 font-semibold' : ''}`}
          >
            <span className={`w-2 h-2 rounded-full ${p.dot}`} />
            {p.label}
            {current === p.value && <span className="ml-auto text-brand-500">✓</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function AssignPopover({ users, currentId, onPick, onAuto, onClose }) {
  const list = (users || []).filter((u) => ['engineer', 'manager', 'admin'].includes(u.role));
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-lg border border-gray-200 dark:border-slate-700
                      bg-white dark:bg-[#1a1a26] shadow-xl p-1 min-w-[200px] max-h-72 overflow-y-auto">
        <button
          onClick={onAuto}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left
                     bg-brand-50/60 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20
                     text-brand-700 dark:text-brand-300 font-semibold mb-1"
        >
          <Icon name="sparkles" className="w-3 h-3" />
          Auto — least loaded
        </button>
        <button
          onClick={() => onPick(null)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left
                     hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400"
        >
          — Unassign —
        </button>
        <div className="my-1 border-t border-gray-100 dark:border-slate-800" />
        {list.map((u) => (
          <button
            key={u.id}
            onClick={() => onPick(u.id)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left
                        hover:bg-brand-50 dark:hover:bg-brand-500/10 transition
                        ${String(currentId) === String(u.id) ? 'bg-brand-50/60 dark:bg-brand-500/10 font-semibold' : ''}`}
          >
            <span className="truncate">{u.name}</span>
            <span className="ml-auto text-[10px] text-gray-400 dark:text-slate-500 capitalize">{u.role}</span>
          </button>
        ))}
        {list.length === 0 && (
          <div className="text-[11px] text-gray-500 dark:text-slate-400 text-center py-2">
            No engineers available
          </div>
        )}
      </div>
    </>
  );
}
