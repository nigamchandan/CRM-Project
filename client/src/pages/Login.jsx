import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/auth/AuthShell.jsx';

const DEMO_ACCOUNTS = [
  { role: 'Admin',    email: 'admin@crm.test',   password: 'admin123',   color: 'bg-brand-600' },
  { role: 'Manager',  email: 'manager@crm.test', password: 'manager123', color: 'bg-emerald-600' },
  { role: 'Engineer', email: 'nigam@crm.test',   password: 'nigam123',   color: 'bg-sky-600' },
  { role: 'Sales',    email: 'sales@crm.test',   password: 'sales123',   color: 'bg-amber-600' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login({ email: form.email, password: form.password });
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  const fillDemo = (acc) => setForm((f) => ({ ...f, email: acc.email, password: acc.password }));

  return (
    <AuthShell
      title="Sign in to your workspace"
      subtitle="Welcome back! Please enter your credentials to continue."
      footer={<>Don't have an account? <Link to="/register" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">Create one</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">✉️</span>
            <input
              type="email" autoComplete="email" autoFocus
              className={`input pl-9 ${errors.email ? '!border-red-300 !ring-red-200 dark:!border-red-500/50' : ''}`}
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          {errors.email && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.email}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label !mb-0">Password</label>
            <a href="#" onClick={(e)=>{e.preventDefault(); toast('Contact your administrator for password reset.');}} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Forgot password?</a>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">🔒</span>
            <input
              type={showPwd ? 'text' : 'password'} autoComplete="current-password"
              className={`input pl-9 pr-10 ${errors.password ? '!border-red-300 !ring-red-200 dark:!border-red-500/50' : ''}`}
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
              aria-label={showPwd ? 'Hide password' : 'Show password'}
            >
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.password}</p>}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 select-none">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(e) => setForm({ ...form, remember: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-800 text-brand-600 focus:ring-brand-500"
          />
          Remember me on this device
        </label>

        <button disabled={loading} className="btn-primary w-full !py-2.5 !text-base shadow-sm">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Signing in…
            </span>
          ) : 'Sign in'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        <span className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider">Try a demo account</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.role}
            type="button"
            onClick={() => fillDemo(acc)}
            className="group flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-brand-300 hover:bg-brand-50/30 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 transition"
            title={`${acc.email} / ${acc.password}`}
          >
            <div className={`w-8 h-8 rounded-full ${acc.color} text-white text-xs font-semibold flex items-center justify-center shadow-sm`}>
              {acc.role[0]}
            </div>
            <div className="text-xs font-semibold text-gray-800 dark:text-slate-100">{acc.role}</div>
            <div className="text-[10px] text-gray-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400">click to fill</div>
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
