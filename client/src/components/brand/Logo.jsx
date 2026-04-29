import { Link } from 'react-router-dom';

/* ---------------------------------------------------------------------------
 *  Modern CRM brand mark — single source of truth for the logo.
 *
 *  Variants
 *    'mark'    : rounded-square icon only (sidebar-collapsed, mobile, avatar).
 *    'inline'  : icon + "Modern CRM" wordmark on one row (sidebar header,
 *                topbar, login mobile).
 *    'stacked' : icon on top of a centred wordmark (auth/marketing hero).
 *
 *  Sizing
 *    sm = 28, md = 36, lg = 44, xl = 56  (px)
 *
 *  All visuals are SVG so the mark stays crisp at every density and supports
 *  hover micro-interactions without flashing/relayout.
 * ----------------------------------------------------------------------- */

const SIZE_PX = { sm: 28, md: 36, lg: 44, xl: 56 };
const RADIUS  = { sm: 8,  md: 10, lg: 12, xl: 14 };
const NAME_TX = { sm: 'text-[13px]', md: 'text-[15px]', lg: 'text-[17px]', xl: 'text-[19px]' };

export default function Logo({
  variant   = 'mark',
  size      = 'md',
  to,                              // wrap in <Link to="..."/> when provided
  href,                            // wrap in <a href="..."/> for external
  tagline,                         // optional small uppercase line under the name
  version,                         // optional version label (e.g. "v1.1")
  interactive = true,              // hover scale + glow boost
  className = '',
  invert    = false,               // light-on-dark variant for hero panels
}) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark size={size} interactive={interactive} />
      {variant !== 'mark' && (
        <Wordmark size={size} tagline={tagline} version={version} invert={invert} stacked={false} />
      )}
    </span>
  );

  if (variant === 'stacked') {
    return (
      <span className={`inline-flex flex-col items-center gap-3 ${className}`}>
        <Mark size={size} interactive={interactive} />
        <Wordmark size={size} tagline={tagline} version={version} invert={invert} stacked />
      </span>
    );
  }

  if (to) return <Link to={to} className="group inline-flex items-center" aria-label="Modern CRM home">{content}</Link>;
  if (href) return <a href={href} className="group inline-flex items-center" aria-label="Modern CRM home">{content}</a>;
  return content;
}

/* ============================================================ Pieces ===== */

/**
 * The icon mark itself — rendered as inline SVG so we get a consistent
 * gradient + highlight + glow no matter where it lands in the layout.
 */
function Mark({ size = 'md', interactive = true }) {
  const px = SIZE_PX[size] || SIZE_PX.md;
  const r  = RADIUS[size]  || RADIUS.md;

  // unique gradient ids — multiple <Logo> instances on the same page must not
  // share an id, otherwise Safari will only render the first instance's fill.
  const id = 'logo-' + size;

  return (
    <span
      className={
        'logo-mark relative inline-flex items-center justify-center ' +
        'rounded-[var(--logo-radius)] ' +
        'transition-transform duration-200 ' +
        (interactive ? 'group-hover:scale-105' : '')
      }
      style={{
        width:  px,
        height: px,
        // Soft brand glow per spec: rgba(139,92,246,0.4) at rest, deeper on hover.
        boxShadow:
          interactive
            ? '0 0 0 1px rgba(255,255,255,0.06), 0 0 18px rgba(139,92,246,0.28)'
            : '0 0 0 1px rgba(255,255,255,0.06), 0 0 12px rgba(139,92,246,0.22)',
        // CSS var lets the rounded-[var(--logo-radius)] class consume it.
        ['--logo-radius']: `${r}px`,
      }}
    >
      <svg viewBox="0 0 64 64" width={px} height={px} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id={`${id}-hl`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}-shine`} cx="0.3" cy="0.2" r="0.7">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="60%"  stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* gradient body */}
        <rect x="0" y="0" width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />
        {/* upper half "lit" highlight */}
        <rect x="0" y="0" width="64" height="32" rx="16" fill={`url(#${id}-hl)`} />
        {/* glassy shine spot in the upper-left */}
        <rect x="0" y="0" width="64" height="64" rx="16" fill={`url(#${id}-shine)`} />

        {/* the "C" — open ring stroked with rounded ends */}
        <path
          d="M44 22.5 A 13.5 13.5 0 1 0 44 41.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="5.25"
          strokeLinecap="round"
        />
      </svg>

      {/* Subtle hover glow boost — separate layer so the SVG itself
          stays render-cheap. */}
      {interactive && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[var(--logo-radius)]
                     opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            boxShadow: '0 0 24px rgba(139,92,246,0.55)',
          }}
        />
      )}
    </span>
  );
}

function Wordmark({ size = 'md', tagline, version, invert, stacked }) {
  const nameCls = NAME_TX[size] || NAME_TX.md;
  const subCls  = invert ? 'text-white/55' : 'text-gray-500 dark:text-slate-500';
  const txt     = invert ? 'text-white'    : 'text-gray-900 dark:text-slate-100';
  const align   = stacked ? 'items-center text-center' : 'items-start text-left';

  return (
    <span className={`flex flex-col leading-tight min-w-0 ${align}`}>
      <span className={`${nameCls} font-semibold tracking-tight truncate ${txt}`}>
        Modern CRM
      </span>
      {(tagline || version) && (
        <span className={`text-[10px] tracking-[0.14em] uppercase truncate ${subCls}`}>
          {tagline || version}
        </span>
      )}
    </span>
  );
}
