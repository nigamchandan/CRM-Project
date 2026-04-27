import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/auth/AuthShell.jsx';

function passwordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'];
  return { score, label: labels[score], color: colors[score] };
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', terms: false });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  const validate = () => {
    const e = {};
    if (!form.name) e.name = 'Name is required';
    if (!form.email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Min 6 characters';
    if (!form.terms) e.terms = 'You must agree to the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      toast.success('Account created!');
      navigate('/');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Get started with Modern CRM in seconds — no credit card required."
      footer={<>Already have an account? <Link to="/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">Sign in</Link></>}
    >
      <div className="mb-4 p-3 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 text-xs text-brand-800 dark:text-brand-300">
        <div className="flex items-start gap-2">
          <span>ℹ️</span>
          <div>
            New accounts are created with the <span className="font-semibold">User</span> role.
            <span className="text-brand-700/80 dark:text-brand-300/80"> Admins and Managers are assigned by an existing admin from the Users page.</span>
          </div>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">👤</span>
            <input
              autoFocus autoComplete="name"
              className={`input pl-9 ${errors.name ? '!border-red-300 !ring-red-200 dark:!border-red-500/50' : ''}`}
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          {errors.name && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="label">Work email</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">✉️</span>
            <input
              type="email" autoComplete="email"
              className={`input pl-9 ${errors.email ? '!border-red-300 !ring-red-200 dark:!border-red-500/50' : ''}`}
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          {errors.email && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">🔒</span>
            <input
              type={showPwd ? 'text' : 'password'} autoComplete="new-password"
              className={`input pl-9 pr-10 ${errors.password ? '!border-red-300 !ring-red-200 dark:!border-red-500/50' : ''}`}
              placeholder="At least 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
          {form.password && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i < strength.score ? strength.color : 'bg-gray-200 dark:bg-slate-700'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Strength: <span className="font-medium text-gray-700 dark:text-slate-200">{strength.label}</span>
              </p>
            </div>
          )}
          {errors.password && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.password}</p>}
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-300 select-none">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-800 text-brand-600 focus:ring-brand-500"
          />
          <span>
            I agree to the <a href="#" className="text-brand-600 dark:text-brand-400 hover:underline">Terms of Service</a>{' '}
            and <a href="#" className="text-brand-600 dark:text-brand-400 hover:underline">Privacy Policy</a>.
          </span>
        </label>
        {errors.terms && <p className="text-xs text-red-600 dark:text-red-400 -mt-2">{errors.terms}</p>}

        <button disabled={loading} className="btn-primary w-full !py-2.5 !text-base shadow-sm">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Creating account…
            </span>
          ) : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
