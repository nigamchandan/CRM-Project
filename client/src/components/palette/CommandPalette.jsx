import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { usePalette } from '../../context/PaletteContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import * as contactsService from '../../services/contactsService';
import * as leadsService    from '../../services/leadsService';
import * as dealsService    from '../../services/dealsService';
import * as ticketsService  from '../../services/ticketsService';

/* ---------------------------------------------------------------------------
 *  CommandPalette — Cmd/Ctrl-K global search & quick actions, Linear /
 *  Stripe-style.  Two modes:
 *    • Empty query → curated list of navigations + the page-aware
 *      "Create new" action.
 *    • Non-empty   → debounced parallel search across contacts, leads,
 *      deals and tickets.  Results group by entity with light icons.
 *
 *  Keyboard:
 *    ↑ / ↓     move highlight
 *    Enter     activate
 *    Esc       close
 * ----------------------------------------------------------------------- */

const NAV_ITEMS = [
  { id: 'nav-dashboard', label: 'Dashboard', hint: 'Go to dashboard',     icon: 'home',       to: '/'         },
  { id: 'nav-contacts',  label: 'Contacts',  hint: 'Go to contacts',      icon: 'users',      to: '/contacts' },
  { id: 'nav-leads',     label: 'Leads',     hint: 'Go to leads',         icon: 'spark',      to: '/leads'    },
  { id: 'nav-deals',     label: 'Deals',     hint: 'Go to deals pipeline',icon: 'briefcase',  to: '/deals'    },
  { id: 'nav-tickets',   label: 'Tickets',   hint: 'Go to tickets',       icon: 'ticket',     to: '/tickets'  },
  { id: 'nav-tasks',     label: 'Tasks',     hint: 'Go to tasks',         icon: 'list',       to: '/tasks'    },
  { id: 'nav-reports',   label: 'Reports',   hint: 'Open analytics',      icon: 'chartBar',   to: '/reports', roles: ['admin','manager','sales','support'] },
  { id: 'nav-settings',  label: 'Settings',  hint: 'Open settings',       icon: 'cog',        to: '/settings',roles: ['admin','manager'] },
  { id: 'nav-logs',      label: 'Audit logs',hint: 'View audit logs',     icon: 'document',   to: '/logs',    roles: ['admin','manager'] },
  { id: 'nav-profile',   label: 'My profile',hint: 'Account settings',    icon: 'userCircle', to: '/profile'  },
];

const PRIORITY_DOT = {
  critical: 'bg-red-500', high: 'bg-orange-500',
  medium:   'bg-amber-400', low: 'bg-gray-400',
};

const ENTITY_META = {
  ticket:  { icon: 'ticket',    label: 'Tickets',  to: (r) => `/tickets/${r.id}` },
  lead:    { icon: 'spark',     label: 'Leads',    to: (r) => `/leads`           },
  deal:    { icon: 'briefcase', label: 'Deals',    to: (r) => `/deals`           },
  contact: { icon: 'users',     label: 'Contacts', to: (r) => `/contacts`        },
};

export default function CommandPalette() {
  const { open, closePalette, triggerCreate, createLabel } = usePalette();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef  = useRef(null);
  const itemRefs = useRef({});

  const [q, setQ]              = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [results, setResults]  = useState({ tickets: [], leads: [], deals: [], contacts: [] });
  const [loading, setLoading]  = useState(false);
  const [active, setActive]    = useState(0);

  /* ----------- focus + reset on open ----------- */
  useEffect(() => {
    if (open) {
      setQ('');
      setDebouncedQ('');
      setActive(0);
      // Slight defer so the input is mounted before .focus()
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  /* ----------- debounce search ----------- */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  /* ----------- run multi-entity search ----------- */
  useEffect(() => {
    if (!open) return;
    if (!debouncedQ) { setResults({ tickets: [], leads: [], deals: [], contacts: [] }); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      ticketsService.list ({ search: debouncedQ, limit: 5 }),
      leadsService.list   ({ search: debouncedQ, limit: 5 }),
      dealsService.list   ({ search: debouncedQ, limit: 5 }),
      contactsService.list({ search: debouncedQ, limit: 5 }),
    ]).then(([t, l, d, c]) => {
      if (cancelled) return;
      setResults({
        tickets:  pickRows(t),
        leads:    pickRows(l),
        deals:    pickRows(d),
        contacts: pickRows(c),
      });
      setActive(0);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debouncedQ, open]);

  /* ----------- flat sections list (drives keyboard nav) ----------- */
  const sections = useMemo(() => {
    if (debouncedQ) {
      const out = [];
      if (results.tickets.length)  out.push({ id: 'tickets',  label: 'Tickets',  rows: results.tickets.map((r)  => ticketRow(r))   });
      if (results.leads.length)    out.push({ id: 'leads',    label: 'Leads',    rows: results.leads.map((r)    => leadRow(r))     });
      if (results.deals.length)    out.push({ id: 'deals',    label: 'Deals',    rows: results.deals.map((r)    => dealRow(r))     });
      if (results.contacts.length) out.push({ id: 'contacts', label: 'Contacts', rows: results.contacts.map((r) => contactRow(r))  });
      return out;
    }
    const visibleNav = NAV_ITEMS.filter((n) => !n.roles || (user && n.roles.includes(user.role)));
    const out = [];
    if (createLabel) {
      out.push({
        id: 'actions',
        label: 'Quick actions',
        rows: [{
          id: 'create-current',
          icon: 'plus',
          title: createLabel,
          subtitle: 'Press N anywhere on this page',
          kind: 'create',
        }],
      });
    }
    out.push({
      id: 'navigate',
      label: 'Navigate',
      rows: visibleNav.map((n) => ({
        id: n.id, icon: n.icon, title: n.label, subtitle: n.hint, kind: 'nav', to: n.to,
      })),
    });
    return out;
  }, [debouncedQ, results, user, createLabel]);

  const flat = useMemo(() => sections.flatMap((s) => s.rows.map((r) => ({ ...r, _section: s.id }))), [sections]);
  const indexById = useMemo(() => {
    const m = new Map();
    flat.forEach((r, i) => m.set(r.id, i));
    return m;
  }, [flat]);

  /* ----------- keyboard nav ----------- */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(flat.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
      else if (e.key === 'Home')    { e.preventDefault(); setActive(0); }
      else if (e.key === 'End')     { e.preventDefault(); setActive(flat.length - 1); }
      else if (e.key === 'Enter')   {
        e.preventDefault();
        const row = flat[active];
        if (row) activate(row);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, flat, active]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----------- scroll active into view ----------- */
  useEffect(() => {
    const node = itemRefs.current[active];
    if (node && listRef.current) {
      const nb = node.getBoundingClientRect();
      const pb = listRef.current.getBoundingClientRect();
      if (nb.top < pb.top)        node.scrollIntoView({ block: 'nearest' });
      else if (nb.bottom > pb.bottom) node.scrollIntoView({ block: 'nearest' });
    }
  }, [active]);

  const activate = (row) => {
    if (!row) return;
    if (row.kind === 'nav')    { navigate(row.to); closePalette(); return; }
    if (row.kind === 'create') { closePalette(); setTimeout(triggerCreate, 50); return; }
    if (row.kind === 'entity') { navigate(row.to); closePalette(); return; }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      className="fixed inset-0 z-[60] flex items-start justify-center pt-24 sm:pt-28 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) closePalette(); }}
    >
      <div className="absolute inset-0 bg-slate-950/40 dark:bg-black/55 backdrop-blur-sm" onClick={closePalette} />

      <div className="relative w-full max-w-xl rounded-2xl border border-gray-200 dark:border-slate-700/80
                      bg-white dark:bg-[#10131c] shadow-card-hover overflow-hidden animate-slide-up">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-800">
          <Icon name="search" className="w-[18px] h-[18px] text-gray-400 dark:text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contacts, leads, deals, tickets…"
            className="flex-1 bg-transparent outline-none text-[15px] text-gray-900 dark:text-slate-100
                       placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
          {loading && (
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Searching…
            </span>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium
                          text-gray-400 dark:text-slate-500
                          bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              {debouncedQ ? `No matches for "${debouncedQ}"` : 'Start typing to search…'}
            </div>
          ) : sections.map((sec) => (
            <div key={sec.id} className="mb-2 last:mb-0">
              <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 font-semibold">
                {sec.label}
              </div>
              <ul>
                {sec.rows.map((row) => {
                  const idx = indexById.get(row.id);
                  const isActive = idx === active;
                  return (
                    <li key={row.id}>
                      <button
                        ref={(el) => { itemRefs.current[idx] = el; }}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => activate(row)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition
                          ${isActive
                            ? 'bg-brand-50 dark:bg-brand-500/10 text-gray-900 dark:text-slate-100'
                            : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
                      >
                        <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center flex-shrink-0
                                         ${isActive
                                           ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
                                           : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                          <Icon name={row.icon} className="w-[15px] h-[15px]" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {row.title}
                            {row.priority && (
                              <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[row.priority] || 'bg-gray-400'}`} />
                            )}
                          </div>
                          {row.subtitle && (
                            <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{row.subtitle}</div>
                          )}
                        </span>
                        {row.suffix && (
                          <span className="text-[11px] text-gray-400 dark:text-slate-500 ml-2 whitespace-nowrap">
                            {row.suffix}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800
                        text-[11px] text-gray-500 dark:text-slate-500
                        flex items-center justify-between">
          <span className="flex items-center gap-3">
            <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
            <span><Kbd>↵</Kbd> open</span>
          </span>
          <span><Kbd>N</Kbd> create new</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center px-1 py-px rounded text-[10px] font-medium
                    text-gray-500 dark:text-slate-400
                    bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
      {children}
    </kbd>
  );
}

function pickRows(settled) {
  if (!settled || settled.status !== 'fulfilled') return [];
  const v = settled.value;
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.data)) return v.data;
  return [];
}

function ticketRow(t) {
  const subtitle = [
    t.ticket_no || `#${t.id}`,
    t.engineer_name ? `· ${t.engineer_name}` : null,
    t.project_name  ? `· ${t.project_name}`  : null,
  ].filter(Boolean).join(' ');
  return {
    id: `ticket-${t.id}`, kind: 'entity', icon: 'ticket',
    title: t.subject || `Ticket ${t.id}`,
    subtitle, priority: t.priority,
    suffix: t.status,
    to: ENTITY_META.ticket.to(t),
  };
}
function leadRow(l) {
  return {
    id: `lead-${l.id}`, kind: 'entity', icon: 'spark',
    title: l.name || l.company || `Lead ${l.id}`,
    subtitle: [l.company, l.email, l.status].filter(Boolean).join(' · '),
    suffix: l.value ? `$${Number(l.value).toLocaleString()}` : null,
    to: ENTITY_META.lead.to(l),
  };
}
function dealRow(d) {
  return {
    id: `deal-${d.id}`, kind: 'entity', icon: 'briefcase',
    title: d.title || `Deal ${d.id}`,
    subtitle: [d.contact_name, d.stage_name].filter(Boolean).join(' · '),
    suffix: d.value ? `$${Number(d.value).toLocaleString()}` : null,
    to: ENTITY_META.deal.to(d),
  };
}
function contactRow(c) {
  return {
    id: `contact-${c.id}`, kind: 'entity', icon: 'users',
    title: c.name || c.email || `Contact ${c.id}`,
    subtitle: [c.company, c.email].filter(Boolean).join(' · '),
    to: ENTITY_META.contact.to(c),
  };
}
