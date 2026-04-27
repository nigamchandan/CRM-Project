import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as authService from '../services/authService';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Icon from '../components/ui/Icon.jsx';

/**
 * My Profile page
 *
 *   ┌────────────────────────────────────────────┐
 *   │ Profile      ← edit name / email           │
 *   │ Change password ← current + new + confirm  │
 *   │ Account info  ← role, status, created (RO) │
 *   └────────────────────────────────────────────┘
 *
 *  Available to every authenticated user, regardless of role.
 */
export default function Profile() {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState('profile');

  if (!user) return null;

  return (
    <>
      <PageHeader title="My Profile" subtitle="Update your personal info, email and password" />

      <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-6">
        {/* ---------------- Sidebar nav ---------------- */}
        <aside className="card p-2 self-start sticky top-4">
          <nav className="space-y-0.5">
            {[
              { id: 'profile',  label: 'Profile',          icon: 'userCircle', sub: 'Name & email' },
              { id: 'password', label: 'Change password',  icon: 'cog',        sub: 'Update credentials' },
              { id: 'account',  label: 'Account info',     icon: 'document',   sub: 'Role & status' },
            ].map((s) => {
              const active = tab === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setTab(s.id)}
                  className={
                    'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition ' +
                    (active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800')
                  }
                >
                  <Icon name={s.icon} className="w-5 h-5 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.label}</div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{s.sub}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ---------------- Body ---------------- */}
        <div>
          {tab === 'profile'  && <ProfileCard  user={user} refresh={refresh} />}
          {tab === 'password' && <PasswordCard />}
          {tab === 'account'  && <AccountCard  user={user} />}
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function ProfileCard({ user, refresh }) {
  const [name, setName]   = useState(user.name  || '');
  const [email, setEmail] = useState(user.email || '');
  const [saving, setSaving] = useState(false);

  // Keep local state in sync if AuthContext refreshes from elsewhere.
  useEffect(() => { setName(user.name || ''); setEmail(user.email || ''); }, [user.id, user.name, user.email]);

  const dirty = (name !== (user.name || '')) || (email !== (user.email || ''));

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      await authService.updateMe({ name: name.trim(), email: email.trim() });
      await refresh?.();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  const initials = (name || user.email || '?')
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <form onSubmit={save} className="card p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Profile</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">This is how others will see you across the workspace.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 flex items-center justify-center text-xl font-semibold">
          {initials}
        </div>
        <div className="text-sm text-gray-500 dark:text-slate-400">
          Avatar is generated from your name's initials.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Full name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arjun Kumar"
            maxLength={150}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
            Used to sign in and receive notifications.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
        <button
          type="button"
          className="btn-secondary"
          disabled={!dirty || saving}
          onClick={() => { setName(user.name || ''); setEmail(user.email || ''); }}
        >
          Reset
        </button>
        <button type="submit" className="btn-primary" disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving]   = useState(false);
  const [show, setShow]       = useState(false);

  const tooShort = next.length > 0 && next.length < 6;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSave  = current && next && confirm && !tooShort && !mismatch && !saving;

  async function save(e) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await authService.changePassword({ current_password: current, new_password: next });
      toast.success('Password changed. Use your new password next time.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card p-6 space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Change password</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Pick a strong password — at least 6 characters. We'll log you in audit history when this changes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="btn-ghost text-xs"
          title={show ? 'Hide passwords' : 'Show passwords'}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Current password</label>
          <input
            className="input"
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            className={'input ' + (tooShort ? 'ring-1 ring-rose-400' : '')}
            type={show ? 'text' : 'password'}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
          />
          {tooShort && <p className="text-[11px] text-rose-500 mt-1">Must be at least 6 characters.</p>}
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input
            className={'input ' + (mismatch ? 'ring-1 ring-rose-400' : '')}
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          {mismatch && <p className="text-[11px] text-rose-500 mt-1">Passwords don't match.</p>}
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-slate-800">
        <button type="submit" className="btn-primary" disabled={!canSave}>
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function AccountCard({ user }) {
  const items = [
    { label: 'Role',          value: capitalize(user.role) },
    { label: 'Status',        value: user.is_active ? 'Active' : 'Inactive' },
    { label: 'Member since',  value: user.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
    { label: 'Last updated',  value: user.updated_at ? new Date(user.updated_at).toLocaleString()    : '—' },
    { label: 'User ID',       value: `#${user.id}` },
  ];
  return (
    <div className="card p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Account info</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
        Read-only details about your account. Contact an admin to change your role.
      </p>
      <dl className="divide-y divide-gray-100 dark:divide-slate-800">
        {items.map((i) => (
          <div key={i.label} className="flex items-center justify-between py-3 text-sm">
            <dt className="text-gray-500 dark:text-slate-400">{i.label}</dt>
            <dd className="font-medium text-gray-900 dark:text-slate-100">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }
