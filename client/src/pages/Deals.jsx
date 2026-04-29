import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as dealsService from '../services/dealsService';
import * as contactsService from '../services/contactsService';
import PageHeader from '../components/ui/PageHeader.jsx';
import Modal from '../components/ui/Modal.jsx';
import { useCreateHandler } from '../context/PaletteContext.jsx';

const EMPTY = { title:'', value:0, stage_id:'', contact_id:'', expected_close_date:'', notes:'' };

export default function Deals() {
  const [board, setBoard] = useState({ columns: [] });
  const [contacts, setContacts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [dragging, setDragging] = useState(null);

  const load = async () => {
    const b = await dealsService.board();
    setBoard(b);
  };

  useEffect(() => { load(); contactsService.list({ limit: 100 }).then(r => setContacts(r.data)); }, []);

  const openNew = (stage_id = '') => { setEditing(null); setForm({ ...EMPTY, stage_id }); setOpen(true); };
  const openNewDefault = useCallback(() => { setEditing(null); setForm(EMPTY); setOpen(true); }, []);
  useCreateHandler(openNewDefault, 'Create deal');
  const openEdit = (d) => { setEditing(d); setForm({
    ...d,
    stage_id: d.stage_id || '',
    contact_id: d.contact_id || '',
    expected_close_date: d.expected_close_date ? d.expected_close_date.slice(0,10) : '',
  }); setOpen(true); };

  const save = async () => {
    try {
      const payload = {
        ...form,
        value: Number(form.value) || 0,
        stage_id: form.stage_id || null,
        contact_id: form.contact_id || null,
        expected_close_date: form.expected_close_date || null,
      };
      if (editing) await dealsService.update(editing.id, payload);
      else await dealsService.create(payload);
      toast.success(editing ? 'Deal updated' : 'Deal created'); setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  const remove = async (d) => {
    if (!confirm(`Delete deal "${d.title}"?`)) return;
    await dealsService.remove(d.id); toast.success('Deleted'); load();
  };

  const handleDragStart = (deal) => setDragging(deal);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = async (stageId) => {
    if (!dragging || dragging.stage_id === stageId) return;
    try {
      await dealsService.moveStage(dragging.id, stageId, 0);
      setDragging(null); load();
    } catch { toast.error('Move failed'); }
  };

  return (
    <>
      <PageHeader
        title="Deals Pipeline" subtitle="Drag & drop deals between stages"
        actions={<button className="btn-primary" onClick={()=>openNew()}>+ New Deal</button>}
      />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.columns.map(col => (
          <div
            key={col.id}
            className="min-w-[280px] w-72 flex-shrink-0"
            onDragOver={handleDragOver}
            onDrop={()=>handleDrop(col.id)}
          >
            <div className="card p-3 mb-3 flex items-center justify-between" style={{ borderTop: `3px solid ${col.color}` }}>
              <div>
                <div className="font-semibold text-gray-800 text-sm">{col.name}</div>
                <div className="text-xs text-gray-500">{col.deals.length} deals · ${col.deals.reduce((a,b)=>a+Number(b.value||0),0).toLocaleString()}</div>
              </div>
              <button className="btn-ghost !px-2 !py-1 text-lg" onClick={()=>openNew(col.id)}>+</button>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {col.deals.map(d => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={()=>handleDragStart(d)}
                  onClick={()=>openEdit(d)}
                  className="card p-3 cursor-grab active:cursor-grabbing hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm text-gray-900">{d.title}</div>
                    <button
                      onClick={(e)=>{ e.stopPropagation(); remove(d); }}
                      className="text-gray-400 hover:text-red-600 text-sm"
                    >×</button>
                  </div>
                  <div className="text-brand-700 text-sm font-semibold mt-1">${Number(d.value).toLocaleString()}</div>
                  {d.contact_name && <div className="text-xs text-gray-500 mt-1">👤 {d.contact_name}</div>}
                  {d.expected_close_date && <div className="text-xs text-gray-400 mt-1">📅 {d.expected_close_date.slice(0,10)}</div>}
                </div>
              ))}
              {col.deals.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">Drop deals here</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={open} onClose={()=>setOpen(false)}
        title={editing ? 'Edit Deal' : 'New Deal'}
        footer={<>
          <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><label className="label">Title *</label><input className="input" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
          <div><label className="label">Value</label><input className="input" type="number" value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/></div>
          <div><label className="label">Stage *</label>
            <select className="input" value={form.stage_id||''} onChange={e=>setForm({...form,stage_id:e.target.value})}>
              <option value="">— Select stage —</option>
              {board.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Contact</label>
            <select className="input" value={form.contact_id||''} onChange={e=>setForm({...form,contact_id:e.target.value})}>
              <option value="">— None —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Expected close date</label>
            <input type="date" className="input" value={form.expected_close_date||''} onChange={e=>setForm({...form,expected_close_date:e.target.value})}/>
          </div>
          <div className="md:col-span-2"><label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/>
          </div>
        </div>
      </Modal>
    </>
  );
}
