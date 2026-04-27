import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal.jsx';
import * as ticketsService from '../../services/ticketsService';
import * as usersService   from '../../services/usersService';

export default function AssignTicketModal({ open, ticket, onClose, onAssigned }) {
  const [users, setUsers]       = useState([]);
  const [userId, setUserId]     = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!open) return;
    usersService.list({ limit: 200 })
      .then((r) => {
        const list = r.data || r;
        // Prefer support/admin roles, but include all
        const sorted = [...list].sort((a, b) => {
          const score = (u) => (u.role === 'admin' ? 0 : u.role === 'manager' ? 1 : 2);
          return score(a) - score(b);
        });
        setUsers(sorted);
      })
      .catch(() => setUsers([]));
  }, [open]);

  useEffect(() => { if (!open) { setUserId(''); } }, [open]);

  if (!ticket) return null;

  const submit = async () => {
    if (!userId) return toast.error('Pick an assignee');
    setLoading(true);
    try {
      await ticketsService.assign(ticket.id, Number(userId));
      const u = users.find((x) => String(x.id) === String(userId));
      toast.success(`Assigned to ${u?.name || `user #${userId}`}`);
      onAssigned?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not assign');
    } finally { setLoading(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign ${ticket.ticket_no || `#${ticket.id}`}`}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={loading}>Cancel</button>
          <button onClick={submit} className="btn-primary" disabled={loading || !userId}>
            {loading ? 'Assigning…' : 'Assign'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 p-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400 font-semibold mb-1">
            {ticket.priority} · {ticket.status}
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{ticket.subject}</div>
        </div>

        <div>
          <label className="label">Assignee</label>
          <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select a teammate…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.role}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
