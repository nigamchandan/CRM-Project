import { Link } from 'react-router-dom';
import ThemeToggle from '../layout/ThemeToggle.jsx';

const FEATURES = [
  { icon: '🎯', title: 'Lead & Deal Management', desc: 'Track every opportunity from first touch to closed-won.' },
  { icon: '🎫', title: 'Built-in Ticketing', desc: 'Resolve customer issues with SLA tracking and threads.' },
  { icon: '⚡', title: 'Real-time Updates', desc: 'See changes instantly across your team via WebSockets.' },
  { icon: '📊', title: 'Insights & Reports', desc: 'Beautiful dashboards powered by your live data.' },
];

const STATS = [
  { value: '10k+', label: 'contacts managed' },
  { value: '99.9%', label: 'uptime SLA' },
  { value: '24/7', label: 'support coverage' },
];

export default function AuthShell({ children, title, subtitle, footer }) {
  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-950">
      {/* LEFT — Brand panel */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-900 text-white">
        <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-8rem] w-[32rem] h-[32rem] rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_40%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center font-bold text-lg">C</div>
            <div>
              <div className="font-semibold tracking-tight">Modern CRM</div>
              <div className="text-xs text-white/60">Customer success, simplified</div>
            </div>
          </Link>

          <div className="max-w-lg">
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
              Manage customers, deals & support in one place.
            </h2>
            <p className="mt-3 text-white/70 leading-relaxed">
              The all-in-one CRM platform for modern teams — built for speed,
              transparency, and real-time collaboration.
            </p>

            <ul className="mt-8 space-y-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-lg flex-shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <div className="font-medium">{f.title}</div>
                    <div className="text-sm text-white/60">{f.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="grid grid-cols-3 gap-6 max-w-md mb-6">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                  <div className="text-xs text-white/60 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-white/50">
              &copy; {new Date().getFullYear()} Modern CRM · v1.0
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT — Form panel */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-12 relative">
        {/* Mobile logo */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">C</div>
          <span className="font-semibold text-gray-900 dark:text-slate-100">Modern CRM</span>
        </div>

        {/* Theme toggle, top-right of form panel */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-400">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="mt-6 text-center text-sm text-gray-600 dark:text-slate-400">{footer}</div>}
        </div>

        <div className="absolute bottom-4 text-[11px] text-gray-400 dark:text-slate-500 hidden sm:block">
          Protected by JWT · Bank-grade encryption
        </div>
      </main>
    </div>
  );
}
