import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal.jsx';
import * as ticketsService from '../../services/ticketsService';

const QUICK_TEMPLATES = [
  { id: 'ack',      label: 'Acknowledge',  body: "Hi {name},\n\nThanks for reaching out — I've received your ticket and I'll look into it right away.\n\nBest,\n" },
  { id: 'info',     label: 'Need info',    body: "Hi {name},\n\nTo investigate further, could you please share:\n• \n• \n\nThanks,\n" },
  { id: 'fixed',    label: 'Resolved',     body: "Hi {name},\n\nGood news — your issue should now be resolved. Please give it another try and let me know if anything still seems off.\n\nThanks,\n" },
];

export default function TicketReplyModal({ open, ticket, onClose, onReplied }) {
  const [body, setBody]         = useState('');
  const [closeAfter, setCloseAfter] = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!open) { setBody(''); setCloseAfter(false); }
  }, [open]);

  if (!ticket) return null;

  const applyTemplate = (tpl) => {
    const name = (ticket.contact_name || '').split(/\s+/)[0] || 'there';
    setBody(tpl.body.replace('{name}', name));
  };

  const submit = async () => {
    if (!body.trim()) return toast.error('Reply cannot be empty');
    setLoading(true);
    try {
      await ticketsService.addComment(ticket.id, body.trim());
      if (closeAfter) {
        await ticketsService.setStatus(ticket.id, 'resolved');
      } else if (ticket.status === 'open') {
        await ticketsService.setStatus(ticket.id, 'in_progress');
      }
      toast.success(closeAfter ? 'Replied & marked resolved' : 'Reply sent');
      onReplied?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send reply');
    } finally { setLoading(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reply to ${ticket.ticket_no || `#${ticket.id}`}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="rounded text-brand-600 focus:ring-brand-500"
              checked={closeAfter}
              onChange={(e) => setCloseAfter(e.target.checked)}
            />
            Mark resolved after sending
          </label>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary" disabled={loading}>Cancel</button>
            <button onClick={submit} className="btn-primary" disabled={loading || !body.trim()}>
              {loading ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Ticket context */}
        <div className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 p-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400 font-semibold mb-1">
            {ticket.priority} · {ticket.status}
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{ticket.subject}</div>
          {ticket.contact_name && (
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Customer: {ticket.contact_name}
              {ticket.contact_email ? ` · ${ticket.contact_email}` : ''}
            </div>
          )}
        </div>

        {/* Templates */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-slate-400 font-semibold mb-2">
            Quick templates
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:border-brand-500/40 dark:hover:text-brand-300 transition"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div>
          <label className="label">Your reply</label>
          <textarea
            className="input font-mono text-sm"
            rows={8}
            placeholder="Write your reply…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
