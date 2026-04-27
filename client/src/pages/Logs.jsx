import { useEffect, useState } from 'react';
import * as logsService from '../services/logsService';
import PageHeader from '../components/ui/PageHeader.jsx';

export default function Logs() {
  const [data, setData] = useState([]);
  const [action, setAction] = useState('');

  useEffect(() => {
    const t = setTimeout(() => logsService.list({ action, limit: 200 }).then(r => setData(r.data)), 250);
    return () => clearTimeout(t);
  }, [action]);

  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Important actions recorded across the system" />
      <div className="card p-4 mb-4">
        <input className="input max-w-sm" placeholder="Filter by action (e.g. lead.create)" value={action} onChange={e=>setAction(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table className="crm-table">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Meta</th></tr></thead>
          <tbody>
            {data.map(l => (
              <tr key={l.id}>
                <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.user_name || <span className="text-gray-400">system</span>}</td>
                <td><span className="badge bg-brand-50 text-brand-700">{l.action}</span></td>
                <td className="text-xs">{l.entity}{l.entity_id ? ` #${l.entity_id}` : ''}</td>
                <td className="text-xs text-gray-600 max-w-xs truncate">{l.meta ? JSON.stringify(l.meta) : ''}</td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={5} className="text-center text-gray-500 py-8">No logs</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
