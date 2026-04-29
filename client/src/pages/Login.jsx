import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/auth/AuthShell.jsx';
import Icon from '../components/ui/Icon.jsx';

/* Demo accounts shown below the form. Each card maps to a seeded user.
 * The dot color hints at the role's "vibe" — stays low-saturation to match
 * the overall premium palette (no neon orange / cherry red). */
const DEMO_ACCOUNTS = [
  { role: 'Admin',    email: 'admin@crm.test',   password: 'admin123',   tone: 'bg-brand-600' },
  { role: 'Manager',  email: 'manager@crm.test', password: 'manager123', tone: 'bg-emerald-500' },
  { role: 'Engineer', email: 'nigam@crm.test',   password: 'nigam123',   tone: 'bg-sky-500' },
  { role: 'Sales',    email: 'sales@crm.test',   password: 'sales123',   tone: 'bg-amber-500' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '', remember: true });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

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
      title="Welcome back"
      subtitle="Sign in to your workspace to continue."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {/* ---------- Email ---------- */}
        <div>
          <label className="label">Email address</label>
          <div className="relative">
            <Icon name="envelope" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-slate-500" />
            <input
              type="email" autoComplete="email" autoFocus
              className={`input pl-10 ${errors.email ? '!border-red-300 !ring-red-100 dark:!border-red-500/50 dark:!ring-red-500/20' : ''}`}
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
        </div>

        {/* ---------- Password ---------- */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label !mb-0">Password</label>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); toast('Contact your administrator for password reset.'); }}
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Icon name="lock" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-slate-500" />
            <input
              type={showPwd ? 'text' : 'password'} autoComplete="current-password"
              className={`input pl-10 pr-11 ${errors.password ? '!border-red-300 !ring-red-100 dark:!border-red-500/50 dark:!ring-red-500/20' : ''}`}
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/60"
              aria-label={showPwd ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPwd ? 'eyeOff' : 'eye'} className="w-[18px] h-[18px]" />
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.password}</p>}
        </div>

        {/* ---------- Remember me ---------- */}
        <label className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-slate-300 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(e) => setForm({ ...form, remember: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-800 text-brand-600 focus:ring-2 focus:ring-brand-500/30"
          />
          Remember me on this device
        </label>

        {/* ---------- Submit ---------- */}
        <button
          disabled={loading}
          className="btn-primary w-full !py-3 !text-[15px] mt-2"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Signing in…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              Sign in
              <Icon name="arrowRight" className="w-4 h-4" />
            </span>
          )}
        </button>
      </form>

      {/* ---------- Demo accounts divider ---------- */}
      <div className="my-7 flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700/60" />
        <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-[0.15em]">
          Try a demo account
        </span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700/60" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.role}
            type="button"
            onClick={() => fillDemo(acc)}
            className="group flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl
                       border border-gray-200 dark:border-slate-700/60
                       bg-white dark:bg-slate-800/30
                       hover:border-brand-300 hover:shadow-glow-sm hover:-translate-y-px
                       dark:hover:border-brand-500/50
                       transition-all"
            title={`${acc.email} / ${acc.password}`}
          >
            <div className={`w-9 h-9 rounded-full ${acc.tone} text-white text-sm font-semibold flex items-center justify-center shadow-inset-top`}>
              {acc.role[0]}
            </div>
            <div className="text-xs font-semibold text-gray-800 dark:text-slate-100">{acc.role}</div>
            <div className="text-[10px] text-gray-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400">
              click to fill
            </div>
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
