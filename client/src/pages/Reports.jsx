import { useEffect, useState } from 'react';
import * as reportsService from '../services/reportsService';
import PageHeader from '../components/ui/PageHeader.jsx';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#ec4899'];

export default function Reports() {
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [resolution, setResolution] = useState(null);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    (async () => {
      const [l, d, r, t] = await Promise.all([
        reportsService.leadsByStatus(),
        reportsService.dealsByStage(),
        reportsService.ticketsResolution(),
        reportsService.revenueTrend(),
      ]);
      setLeads(l); setDeals(d); setResolution(r); setTrend(t);
    })();
  }, []);

  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="Insights across your CRM" />

      {resolution && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="card p-4"><div className="text-xs text-gray-500">Total tickets</div><div className="text-xl font-semibold">{resolution.total}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Open</div><div className="text-xl font-semibold text-blue-600">{resolution.open_count}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">In progress</div><div className="text-xl font-semibold text-amber-600">{resolution.in_progress_count}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Resolved</div><div className="text-xl font-semibold text-emerald-600">{resolution.resolved_count}</div></div>
          <div className="card p-4"><div className="text-xs text-gray-500">Avg resolution (h)</div><div className="text-xl font-semibold">{Number(resolution.avg_resolution_hours).toFixed(1)}</div></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Leads by status</h3>
          <div style={{height:280}}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={leads} dataKey="count" nameKey="status" outerRadius={90} label>
                  {leads.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend /><Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-3">Deals by stage (count)</h3>
          <div style={{height:280}}>
            <ResponsiveContainer>
              <BarChart data={deals}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{fontSize:12}} /><YAxis tick={{fontSize:12}} /><Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3">Revenue trend (12 months)</h3>
          <div style={{height:300}}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{fontSize:12}} /><YAxis tick={{fontSize:12}} /><Tooltip />
                <Line type="monotone" dataKey="total_value" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
