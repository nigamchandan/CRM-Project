import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal.jsx';
import * as contactsService from '../../services/contactsService';
import * as tasksService    from '../../services/tasksService';

// Quick-action: "Log call". Stores the call as a *completed* task with related_type='contact'.
// Optionally schedules a follow-up task for later.
export default function LogCallModal({ open, onClose, onLogged }) {
  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState('');
  const [outcome, setOutcome]   = useState('connected');
  const [notes, setNotes]       = useState('');
  const [followUp, setFollowUp] = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!open) return;
    contactsService.list({ limit: 100 }).then((r) => setContacts(r.data || r));
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setContactId(''); setOutcome('connected'); setNotes(''); setFollowUp('');
    }
  }, [open]);

  const submit = async () => {
    if (!contactId) return toast.error('Pick a contact');
    setLoading(true);
    try {
      const contact = contacts.find((c) => String(c.id) === String(contactId));
      const title = `Call: ${contact?.name || `Contact #${contactId}`} (${outcome})`;

      // 1. Log the completed call as a task
      await tasksService.create({
        title,
        description: notes || null,
        priority: 'low',
        status: 'completed',
        related_type: 'contact',
        related_id: Number(contactId),
      });

      // 2. Schedule a follow-up if requested
      if (followUp) {
        await tasksService.create({
          title: `Follow up with ${contact?.name || 'contact'}`,
          description: notes || null,
          due_date: new Date(followUp).toISOString(),
          priority: 'medium',
          status: 'pending',
          related_type: 'contact',
          related_id: Number(contactId),
        });
      }

      toast.success(followUp ? 'Call logged + follow-up scheduled' : 'Call logged');
      onLogged?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not log call');
    } finally { setLoading(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log a call"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={loading}>Cancel</button>
          <button onClick={submit} className="btn-primary" disabled={loading || !contactId}>
            {loading ? 'Saving…' : 'Log call'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Contact</label>
          <select
            className="input"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">Select a contact…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.company ? ` — ${c.company}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Outcome</label>
          <div className="grid grid-cols-3 gap-2">
            {['connected', 'voicemail', 'no answer'].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(o)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition capitalize
                  ${outcome === o
                    ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500/40 dark:text-brand-300'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Notes <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span></label>
          <textarea
            className="input"
            rows={3}
            placeholder="What was discussed?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Schedule a follow-up <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span></label>
          <input
            type="datetime-local"
            className="input"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
