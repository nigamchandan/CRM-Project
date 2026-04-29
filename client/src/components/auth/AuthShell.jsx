import ThemeToggle from '../layout/ThemeToggle.jsx';
import Logo from '../brand/Logo.jsx';

/* ----------------------------------------------------------------------------
 * AuthShell — split-panel auth layout (Stripe-inspired).
 *
 *   Left  : brand / value-prop panel with deep-indigo gradient and aurora glow.
 *   Right : the form itself (login / register / forgot-password).
 *
 * The left panel collapses below 1024px so mobile users land straight on the
 * form. Only ever rendered on auth routes.
 * -------------------------------------------------------------------------- */

const FEATURES = [
  { title: 'Lead & deal pipeline',  desc: 'Visual sales kanban — track every opportunity from first touch to closed-won.' },
  { title: 'Built-in ticketing',    desc: 'Resolve customer issues with SLA tracking, automated routing, and threaded comments.' },
  { title: 'Real-time collaboration', desc: 'Updates sync instantly across your team. No refresh, no stale data.' },
  { title: 'Insights you can act on',  desc: 'Beautiful dashboards powered by your live numbers — not yesterday\u2019s exports.' },
];

const STATS = [
  { value: '10k+',  label: 'contacts managed' },
  { value: '99.9%', label: 'uptime SLA' },
  { value: '24/7',  label: 'support coverage' },
];

export default function AuthShell({ children, title, subtitle, footer }) {
  return (
    <div className="min-h-screen flex bg-white dark:bg-[#0a0a14]">
      {/* ====================================================================
          LEFT — brand panel
          ==================================================================== */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden text-white">
        {/* Layered gradient: deep indigo → violet, with aurora glow blobs */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1750] via-[#3f37b8] to-[#635bff]" />
        <div className="absolute -top-40 -left-40 w-[34rem] h-[34rem] rounded-full bg-[#8b6cf5]/30 blur-[100px]" />
        <div className="absolute bottom-[-14rem] right-[-10rem] w-[36rem] h-[36rem] rounded-full bg-[#b66cf5]/25 blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.10),transparent_45%)]" />
        {/* Subtle dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          {/* Brand mark */}
          <Logo
            to="/"
            variant="inline"
            size="lg"
            tagline="Customer success, simplified"
            invert
          />

          {/* Headline + features */}
          <div className="max-w-lg">
            <h2 className="text-3xl xl:text-[2.6rem] font-semibold leading-[1.1] tracking-tight"
                style={{ letterSpacing: '-0.03em' }}>
              The CRM that grows<br />
              <span className="bg-gradient-to-r from-white via-white to-[#c5cbff] bg-clip-text text-transparent">
                with your team.
              </span>
            </h2>
            <p className="mt-4 text-white/70 leading-relaxed text-[15px]">
              An all-in-one workspace for sales, support, and customer
              success — built for speed, transparency, and real-time
              collaboration.
            </p>

            <ul className="mt-10 space-y-5">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3.5">
                  <div className="mt-1 w-5 h-5 rounded-full bg-white/15 border border-white/25
                                  flex items-center justify-center flex-shrink-0
                                  shadow-inset-top">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-[15px] leading-tight">{f.title}</div>
                    <div className="text-sm text-white/60 mt-0.5 leading-relaxed">{f.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Stats + footer */}
          <div>
            <div className="grid grid-cols-3 gap-6 max-w-md mb-6 pt-6 border-t border-white/10">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
                  <div className="text-[11px] text-white/55 mt-0.5 leading-snug">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-white/40 tracking-wide">
              &copy; {new Date().getFullYear()} Modern CRM &middot; v1.1
            </div>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          RIGHT — form panel
          ==================================================================== */}
      <main className="flex-1 flex flex-col items-center justify-center
                       px-4 py-10 sm:px-6 lg:px-12 relative">
        {/* Mobile brand */}
        <div className="lg:hidden absolute top-6 left-6">
          <Logo to="/" variant="inline" size="md" />
        </div>

        {/* Theme toggle, top-right of form panel */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8">
            <h1 className="display-title">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-[15px] text-gray-500 dark:text-slate-400 leading-relaxed">{subtitle}</p>
            )}
          </div>

          {children}

          {footer && (
            <div className="mt-8 text-center text-sm text-gray-600 dark:text-slate-400">
              {footer}
            </div>
          )}
        </div>

        <div className="absolute bottom-4 text-[11px] text-gray-400 dark:text-slate-500 hidden sm:block tracking-wide">
          Protected by JWT &middot; Bank-grade encryption
        </div>
      </main>
    </div>
  );
}
