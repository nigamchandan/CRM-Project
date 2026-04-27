import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as tasksService from '../services/tasksService';
import * as usersService from '../services/usersService';
import PageHeader from '../components/ui/PageHeader.jsx';
import Modal from '../components/ui/Modal.jsx';
import Badge from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const PRIORITIES = ['low','medium','high'];
const STATUSES = ['pending','in_progress','completed'];
const EMPTY = { title:'', description:'', due_date:'', priority:'medium', status:'pending', assigned_to:'' };

export default function Tasks() {
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]);
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const r = await tasksService.list({ mine: mine ? 'true' : undefined, limit: 100 });
    setData(r.data);
  };
  useEffect(() => { usersService.list({ limit: 100 }).then(r => setUsers(r.data)); }, []);
  useEffect(() => { load(); }, [mine]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({
    ...t,
    assigned_to: t.assigned_to || '',
    due_date: t.due_date ? t.due_date.slice(0,16) : '',
  }); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...form, assigned_to: form.assigned_to || null, due_date: form.due_date || null };
      if (editing) await tasksService.update(editing.id, payload);
      else await tasksService.create(payload);
      toast.success(editing ? 'Task updated' : 'Task created'); setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  const toggleComplete = async (t) => {
    await tasksService.complete(t.id, t.status !== 'completed'); load();
  };

  const remove = async (t) => {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    await tasksService.remove(t.id); toast.success('Deleted'); load();
  };

  return (
    <>
      <PageHeader
        title="Tasks" subtitle="Your to-do list"
        actions={<button className="btn-primary" onClick={openNew}>+ New Task</button>}
      />
      <div className="card p-4 mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)} /> My tasks only
        </label>
      </div>

      {data.length === 0 ? <EmptyState title="No tasks" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(t => (
            <div key={t.id} className={`card p-4 ${t.status === 'completed' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={t.status === 'completed'}
                  onChange={()=>toggleComplete(t)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-gray-900 ${t.status === 'completed' ? 'line-through' : ''}`}>{t.title}</div>
                  {t.description && <div className="text-sm text-gray-600 mt-1 line-clamp-2">{t.description}</div>}
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                    <Badge value={t.priority} />
                    <Badge value={t.status} />
                    {t.due_date && <span className="text-gray-500">📅 {new Date(t.due_date).toLocaleDateString()}</span>}
                    {t.assigned_name && <span className="text-gray-500">👤 {t.assigned_name}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={()=>openEdit(t)}>Edit</button>
                  <button className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={()=>remove(t)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open} onClose={()=>setOpen(false)}
        title={editing ? 'Edit Task' : 'New Task'}
        footer={<>
          <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </>}
      >
        <div className="space-y-4">
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Due date</label>
              <input type="datetime-local" className="input" value={form.due_date||''} onChange={e=>setForm({...form,due_date:e.target.value})}/>
            </div>
            <div><label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Assigned to</label>
              <select className="input" value={form.assigned_to||''} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
                <option value="">— Me —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
