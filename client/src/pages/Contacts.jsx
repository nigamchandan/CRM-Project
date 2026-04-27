import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as contactsService from '../services/contactsService';
import PageHeader from '../components/ui/PageHeader.jsx';
import Modal from '../components/ui/Modal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const EMPTY = { name: '', email: '', phone: '', company: '', address: '', tags: [] };

export default function Contacts() {
  const [data, setData]       = useState([]);
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await contactsService.list({ search, limit: 100 });
    setData(res.data);
    setLoading(false);
  };

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...c, tags: c.tags || [] }); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...form, tags: typeof form.tags === 'string' ? form.tags.split(',').map(s=>s.trim()).filter(Boolean) : form.tags };
      if (editing) await contactsService.update(editing.id, payload);
      else await contactsService.create(payload);
      toast.success(editing ? 'Contact updated' : 'Contact created');
      setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  const remove = async (c) => {
    if (!confirm(`Delete contact "${c.name}"?`)) return;
    await contactsService.remove(c.id);
    toast.success('Deleted'); load();
  };

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="Manage your customer contacts"
        actions={<button className="btn-primary" onClick={openNew}>+ New Contact</button>}
      />
      <div className="card mb-4 p-4">
        <input className="input max-w-sm" placeholder="Search contacts..." value={search} onChange={(e)=>setSearch(e.target.value)} />
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : data.length === 0 ? (
        <EmptyState title="No contacts yet" subtitle="Create your first contact" action={<button className="btn-primary" onClick={openNew}>+ New Contact</button>} />
      ) : (
        <div className="table-wrap">
          <table className="crm-table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Tags</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {data.map(c => (
                <tr key={c.id}>
                  <td className="font-medium text-gray-900">{c.name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.company}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags||[]).map(t => <span key={t} className="badge bg-brand-50 text-brand-700">{t}</span>)}
                    </div>
                  </td>
                  <td className="text-right">
                    <button className="btn-ghost !px-2 !py-1" onClick={()=>openEdit(c)}>Edit</button>
                    <button className="btn-ghost !px-2 !py-1 text-red-600" onClick={()=>remove(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open} onClose={()=>setOpen(false)}
        title={editing ? 'Edit Contact' : 'New Contact'}
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
          <div className="md:col-span-2"><label className="label">Address</label><input className="input" value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></div>
          <div className="md:col-span-2"><label className="label">Tags (comma separated)</label>
            <input className="input" value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags} onChange={e=>setForm({...form,tags:e.target.value})}/>
          </div>
        </div>
      </Modal>
    </>
  );
}
