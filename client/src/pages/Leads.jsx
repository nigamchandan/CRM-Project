import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as leadsService from '../services/leadsService';
import * as usersService from '../services/usersService';
import PageHeader from '../components/ui/PageHeader.jsx';
import Modal from '../components/ui/Modal.jsx';
import Badge from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { useCreateHandler } from '../context/PaletteContext.jsx';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'];
const EMPTY = { name:'', email:'', phone:'', company:'', source:'', status:'new', value:0, assigned_to:'', notes:'' };

export default function Leads() {
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const res = await leadsService.list({ search, status: statusF || undefined, limit: 100 });
    setData(res.data);
  };

  useEffect(() => {
    usersService.list({ limit: 100 }).then(r => setUsers(r.data));
  }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, statusF]);

  const openNew = useCallback(() => { setEditing(null); setForm(EMPTY); setOpen(true); }, []);
  useCreateHandler(openNew, 'Create lead');
  const openEdit = (l) => { setEditing(l); setForm({ ...l, assigned_to: l.assigned_to || '' }); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...form, assigned_to: form.assigned_to || null, value: Number(form.value) || 0 };
      if (editing) await leadsService.update(editing.id, payload);
      else await leadsService.create(payload);
      toast.success(editing ? 'Lead updated' : 'Lead created'); setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  const changeStatus = async (l, status) => {
    await leadsService.setStatus(l.id, status);
    toast.success('Status updated'); load();
  };

  const remove = async (l) => {
    if (!confirm(`Delete lead "${l.name}"?`)) return;
    await leadsService.remove(l.id); toast.success('Deleted'); load();
  };

  return (
    <>
      <PageHeader
        title="Leads" subtitle="Track & convert leads"
        actions={<button className="btn-primary" onClick={openNew}>+ New Lead</button>}
      />
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search leads..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="input max-w-[180px]" value={statusF} onChange={e=>setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No leads found" subtitle="Create a new lead to get started" />
      ) : (
        <div className="table-wrap">
          <table className="crm-table">
            <thead><tr><th>Name</th><th>Company</th><th>Source</th><th>Value</th><th>Status</th><th>Assigned</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {data.map(l => (
                <tr key={l.id}>
                  <td>
                    <div className="font-medium text-gray-900">{l.name}</div>
                    <div className="text-xs text-gray-500">{l.email}</div>
                  </td>
                  <td>{l.company}</td>
                  <td>{l.source}</td>
                  <td>${Number(l.value).toLocaleString()}</td>
                  <td>
                    <select
                      className="text-xs border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-200"
                      value={l.status} onChange={e=>changeStatus(l, e.target.value)}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>{l.assigned_name || <span className="text-gray-400">—</span>}</td>
                  <td className="text-right">
                    <button className="btn-ghost !px-2 !py-1" onClick={()=>openEdit(l)}>Edit</button>
                    <button className="btn-ghost !px-2 !py-1 text-red-600" onClick={()=>remove(l)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open} onClose={()=>setOpen(false)}
        title={editing ? 'Edit Lead' : 'New Lead'}
        footer={<>
          <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
          <div><label className="label">Email</label><input className="input" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
          <div><label className="label">Company</label><input className="input" value={form.company||''} onChange={e=>setForm({...form,company:e.target.value})}/></div>
          <div><label className="label">Source</label><input className="input" value={form.source||''} onChange={e=>setForm({...form,source:e.target.value})}/></div>
          <div><label className="label">Value</label><input className="input" type="number" value={form.value||0} onChange={e=>setForm({...form,value:e.target.value})}/></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">Assigned to</label>
            <select className="input" value={form.assigned_to||''} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/>
          </div>
        </div>
      </Modal>
    </>
  );
}
