import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as usersService from '../services/usersService';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Modal from '../components/ui/Modal.jsx';

const ROLES = ['admin','manager','engineer','user'];
const EMPTY = { name:'', email:'', password:'', role:'user' };

export default function Users() {
  const { user: current } = useAuth();
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const isAdmin = current?.role === 'admin';

  const load = async () => {
    const r = await usersService.list({ search, limit: 100 });
    setData(r.data);
  };

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ ...u, password: '' }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) {
        await usersService.update(editing.id, { name: form.name, email: form.email, role: form.role });
      } else {
        await usersService.create(form);
      }
      toast.success(editing ? 'User updated' : 'User created'); setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  const toggle = async (u) => { await usersService.toggleStatus(u.id, !u.is_active); load(); };
  const remove = async (u) => {
    if (!confirm(`Delete user "${u.name}"?`)) return;
    await usersService.remove(u.id); toast.success('Deleted'); load();
  };

  return (
    <>
      <PageHeader
        title="Users" subtitle="Team members and roles"
        actions={isAdmin && <button className="btn-primary" onClick={openNew}>+ New User</button>}
      />
      <div className="card p-4 mb-4">
        <input className="input max-w-sm" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="crm-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {data.map(u => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.email}</td>
                <td className="capitalize">{u.role}</td>
                <td>
                  <span className={`badge ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.is_active ? 'active' : 'disabled'}
                  </span>
                </td>
                <td className="text-right">
                  {isAdmin && (
                    <>
                      <button className="btn-ghost !px-2 !py-1" onClick={()=>openEdit(u)}>Edit</button>
                      <button className="btn-ghost !px-2 !py-1" onClick={()=>toggle(u)}>{u.is_active ? 'Disable' : 'Enable'}</button>
                      <button className="btn-ghost !px-2 !py-1 text-red-600" onClick={()=>remove(u)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={open} onClose={()=>setOpen(false)}
        title={editing ? 'Edit User' : 'New User'}
        footer={<>
          <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </>}
      >
        <div className="space-y-4">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
          <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
          {!editing && (
            <div><label className="label">Password *</label><input className="input" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>
          )}
          <div><label className="label">Role</label>
            <select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </>
  );
}
