import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as ticketsService from '../services/ticketsService';
import * as usersService from '../services/usersService';
import * as ticketPipelinesService from '../services/ticketPipelinesService';
import Icon from '../components/ui/Icon.jsx';
import Badge from '../components/ui/Badge.jsx';

const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];

// =========================================================================
//  TicketDetail — HubSpot-inspired 3-column workspace
//
//   ┌──────────────┬─────────────────────────┬──────────────────┐
//   │ Summary card │ Activity timeline + tabs│ Associations     │
//   │   (320px)    │   (flex-1)              │    (320px)       │
//   └──────────────┴─────────────────────────┴──────────────────┘
// =========================================================================
export default function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket]     = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [users, setUsers]       = useState([]);
  const [stages, setStages]     = useState([]);

  const load = async () => {
    const [t, c, a] = await Promise.all([
      ticketsService.get(id),
      ticketsService.listComments(id),
      ticketsService.listActivity(id).catch(() => []),
    ]);
    setTicket(t);
    setComments(c);
    setActivity(a);
    if (t?.pipeline_id) {
      ticketPipelinesService.listStages(t.pipeline_id).then(setStages).catch(() => {});
    }
  };

  useEffect(() => {
    load();
    usersService.list({ limit: 200 }).then((r) => setUsers(r.data));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-96 text-sm text-gray-500 dark:text-slate-400">
        Loading ticket…
      </div>
    );
  }

  return (
    <div className="-mt-2 grid grid-cols-1 lg:grid-cols-[320px,1fr] xl:grid-cols-[320px,1fr,320px] gap-4">
      <SummaryColumn
        ticket={ticket}
        users={users}
        stages={stages}
        onChange={load}
      />
      <CenterColumn
        ticket={ticket}
        comments={comments}
        activity={activity}
        onCommented={load}
      />
      <AssociationsColumn ticket={ticket} comments={comments} />
    </div>
  );
}

/* =========================================================================
 * LEFT — Summary column
 * =======================================================================*/
function SummaryColumn({ ticket, users, stages, onChange }) {
  const [openAbout, setOpenAbout] = useState(true);

  const setStage = async (stageId) => {
    try { await ticketsService.setStage(ticket.id, Number(stageId)); toast.success('Stage updated'); onChange(); }
    catch { toast.error('Stage update failed'); }
  };
  const setStatus = async (status) => {
    try { await ticketsService.setStatus(ticket.id, status); toast.success('Status updated'); onChange(); }
    catch { toast.error('Status update failed'); }
  };
  const assign = async (userId) => {
    try {
      await ticketsService.assign(ticket.id, { assigned_engineer_id: userId || null, user_id: userId || null });
      toast.success(userId ? 'Assigned' : 'Unassigned');
      onChange();
    } catch { toast.error('Assignment failed'); }
  };
  /** Generic single-field PATCH used by light-touch dropdowns in this column. */
  const updateField = async (field, value) => {
    try {
      await ticketsService.update(ticket.id, { [field]: value });
      toast.success('Updated');
      onChange();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    }
  };

  const stageColor = ticket.stage_color || '#6b7280';

  return (
    <aside className="space-y-4">
      {/* Top breadcrumb / actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/tickets"
          className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
        >
          <span aria-hidden>←</span> Tickets
        </Link>
        <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 dark:text-slate-400">
          {ticket.ticket_no || `#${ticket.id}`}
        </span>
      </div>

      {/* Subject card */}
      <div className="card p-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-base font-semibold leading-snug text-gray-900 dark:text-slate-100">
            {ticket.subject}
          </h2>
          <button
            className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400"
            title="Rename ticket (use Activities tab)"
          >
            <Icon name="cog" className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 space-y-1.5 text-xs">
          <MetaRow label="Create date" value={fmtDateTime(ticket.created_at)} />
          {ticket.pipeline_name && (
            <MetaRow label="Pipeline" value={ticket.pipeline_name} />
          )}
          <MetaRow
            label="Ticket status"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: stageColor }} />
                {ticket.stage_name || ticket.status}
              </span>
            }
          />
          {ticket.sla_due_at && (
            <MetaRow
              label="SLA due"
              value={
                <span className={isPast(ticket.sla_due_at) && ticket.status !== 'closed'
                  ? 'text-red-600 dark:text-red-400 font-medium'
                  : ''}
                >
                  {fmtDateTime(ticket.sla_due_at)}
                </span>
              }
            />
          )}
        </div>

        {/* Quick action row (visual parity with HubSpot) */}
        <div className="mt-4 grid grid-cols-5 gap-1 text-[10px]">
          {[
            { id: 'note',    label: 'Note',    icon: 'document' },
            { id: 'email',   label: 'Email',   icon: 'envelope' },
            { id: 'call',    label: 'Call',    icon: 'bell' },
            { id: 'task',    label: 'Task',    icon: 'checkCircle' },
            { id: 'more',    label: 'More',    icon: 'menu' },
          ].map((b) => (
            <button
              key={b.id}
              className="flex flex-col items-center gap-1 py-2 rounded-lg border border-gray-100 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
              onClick={() => {
                const el = document.getElementById('reply-composer');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.focus?.();
              }}
            >
              <Icon name={b.icon} className="w-4 h-4" />
              <span className="leading-3">{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* About this ticket */}
      <Section
        title="About this ticket"
        open={openAbout}
        onToggle={() => setOpenAbout((v) => !v)}
      >
        <div className="space-y-3 text-xs">
          {ticket.description && (
            <Field label="Ticket description">
              <p className="whitespace-pre-wrap text-gray-700 dark:text-slate-300 leading-relaxed">
                {ticket.description}
              </p>
            </Field>
          )}
          <Field label="Ticket owner">
            <select
              className="input !py-1.5 !text-xs"
              value={ticket.assigned_engineer_id || ticket.assigned_to || ''}
              onChange={(e) => assign(e.target.value || null)}
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          {ticket.project_manager_name && (
            <Field label="Project Manager">
              <PersonChip name={ticket.project_manager_name} email={ticket.project_manager_email} />
            </Field>
          )}
          {ticket.reporting_manager_name && (
            <Field label="Reporting manager">
              <PersonChip name={ticket.reporting_manager_name} email={ticket.reporting_manager_email} />
            </Field>
          )}
          {ticket.source && (
            <Field label="Source">
              <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-slate-300 capitalize">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                {ticket.source}
              </span>
            </Field>
          )}
          {ticket.reporter_name && (
            <Field label="Reporter">
              <div className="text-gray-700 dark:text-slate-300">{ticket.reporter_name}</div>
              {ticket.reporter_email && <div className="text-gray-500 dark:text-slate-400">{ticket.reporter_email}</div>}
              {ticket.reporter_phone && <div className="text-gray-500 dark:text-slate-400">{ticket.reporter_phone}</div>}
            </Field>
          )}
          {ticket.location_name && (
            <Field label="Location">
              <span className="text-gray-700 dark:text-slate-300">{ticket.location_name}{ticket.location_code ? ` · ${ticket.location_code}` : ''}</span>
            </Field>
          )}
          {ticket.team_name && (
            <Field label="Team">
              <span className="text-gray-700 dark:text-slate-300">{ticket.team_name}</span>
            </Field>
          )}
          <Field label="Priority">
            <Badge value={ticket.priority} />
          </Field>
          <Field label="Type">
            <select
              className="input !py-1.5 !text-xs"
              value={ticket.ticket_type || 'incident'}
              onChange={(e) => updateField('ticket_type', e.target.value)}
            >
              <option value="incident">Incident</option>
              <option value="request">Request</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Pipeline & status quick controls */}
      <Section title="Pipeline & status" open>
        <div className="space-y-3 text-xs">
          {stages.length > 0 && (
            <Field label="Stage">
              <select
                className="input !py-1.5 !text-xs"
                value={ticket.pipeline_stage_id || ''}
                onChange={(e) => setStage(e.target.value)}
              >
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Status">
            <select
              className="input !py-1.5 !text-xs"
              value={ticket.status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {ticket.escalation_level > 0 && (
            <Field label="Escalation">
              <span className="badge bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 font-semibold">
                Level {ticket.escalation_level}
              </span>
            </Field>
          )}
          <Field label="Created">
            <span className="text-gray-700 dark:text-slate-300">{fmtDateTime(ticket.created_at)}</span>
          </Field>
          {ticket.closed_at && (
            <Field label="Closed">
              <span className="text-gray-700 dark:text-slate-300">{fmtDateTime(ticket.closed_at)}</span>
            </Field>
          )}
        </div>
      </Section>
    </aside>
  );
}

/* =========================================================================
 * MIDDLE — Activity / Overview / Comments
 * =======================================================================*/
function CenterColumn({ ticket, comments, activity, onCommented }) {
  const [tab, setTab] = useState('activities');

  return (
    <section className="card overflow-hidden">
      {/* Top tabs */}
      <div className="flex items-center border-b border-gray-100 dark:border-slate-800">
        <TopTab id="overview"   tab={tab} onSelect={setTab} label="Overview" />
        <TopTab id="activities" tab={tab} onSelect={setTab} label="Activities" />
        <TopTab id="comments"   tab={tab} onSelect={setTab} label={`Comments (${comments.length})`} />
        <div className="flex-1" />
        <button className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1">
          <Icon name="cog" className="w-3.5 h-3.5" /> Customize
        </button>
      </div>

      <div className="p-5">
        {tab === 'overview'   && <OverviewTab ticket={ticket} />}
        {tab === 'activities' && <ActivitiesTab ticket={ticket} comments={comments} activity={activity} onCommented={onCommented} />}
        {tab === 'comments'   && <CommentsTab ticket={ticket} comments={comments} onCommented={onCommented} />}
      </div>
    </section>
  );
}

function TopTab({ id, tab, onSelect, label }) {
  const active = tab === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`px-4 py-3 text-sm font-medium transition relative
        ${active
          ? 'text-brand-600 dark:text-brand-400'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
    >
      {label}
      {active && (
        <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 dark:bg-brand-400" />
      )}
    </button>
  );
}

/* ----------------------------- Overview tab ----------------------------- */
function OverviewTab({ ticket }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-2">Description</h3>
        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
          {ticket.description || <span className="text-gray-400 dark:text-slate-500 italic">No description provided.</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FactCard label="Pipeline" value={ticket.pipeline_name} />
        <FactCard label="Stage"    value={ticket.stage_name} dot={ticket.stage_color} />
        <FactCard label="Priority" value={<Badge value={ticket.priority} />} />
        <FactCard label="Type"     value={<TypeBadge value={ticket.ticket_type} />} />
        <FactCard label="Source"   value={ticket.source} />
        <FactCard label="Project"  value={ticket.project_name} sub={ticket.project_code} />
        <FactCard label="Location" value={ticket.location_name} sub={ticket.location_code} />
        <FactCard label="Team"     value={ticket.team_name} />
        <FactCard
          label="SLA due"
          value={ticket.sla_due_at ? fmtDateTime(ticket.sla_due_at) : '—'}
          tone={isPast(ticket.sla_due_at) && ticket.status !== 'closed' ? 'red' : undefined}
        />
      </div>
    </div>
  );
}

/**
 * Tiny incident/request pill — same visual language as the Tickets list so the
 * classification is instantly recognisable as the user moves between screens.
 */
function TypeBadge({ value }) {
  const v = value || 'incident';
  const tone = v === 'request'
    ? 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-800'
    : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 capitalize ${tone}`}>
      {v}
    </span>
  );
}

function FactCard({ label, value, sub, dot, tone }) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-slate-800 p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">{label}</div>
      <div className={`flex items-center gap-2 text-sm font-medium ${tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-slate-200'}`}>
        {dot && <span className="inline-block w-2 h-2 rounded-full" style={{ background: dot }} />}
        <span>{value || <span className="text-gray-400 dark:text-slate-500 font-normal">—</span>}</span>
      </div>
      {sub && <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ----------------------------- Activities tab --------------------------- */
const ACTIVITY_FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'note',    label: 'Notes' },
  { id: 'status',  label: 'Status' },
  { id: 'stage',   label: 'Stage' },
  { id: 'assign',  label: 'Assignments' },
];

function ActivitiesTab({ ticket, comments, activity, onCommented }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const merged = useMemo(() => buildTimeline(activity, comments), [activity, comments]);

  const filtered = merged.filter((it) => {
    if (filter !== 'all') {
      if (filter === 'note'   && it.type !== 'note') return false;
      if (filter === 'status' && it.action !== 'ticket.status') return false;
      if (filter === 'stage'  && it.action !== 'ticket.stage') return false;
      if (filter === 'assign' && it.action !== 'ticket.assign') return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${it.actor || ''} ${it.title || ''} ${it.body || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const byMonth = groupByMonth(filtered);

  return (
    <div className="space-y-4">
      {/* Reply composer at the top */}
      <ReplyComposer ticketId={ticket.id} onPosted={onCommented} />

      {/* Filter chips + search */}
      <div className="flex flex-wrap items-center gap-2">
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition
              ${filter === f.id
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-brand-400'}`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto relative">
          <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input !py-1.5 !pl-7 !text-xs w-48"
            placeholder="Search activities"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-5">
        {byMonth.length === 0 && (
          <div className="text-center text-sm text-gray-500 dark:text-slate-400 py-10">
            No activities match these filters.
          </div>
        )}
        {byMonth.map((g) => (
          <div key={g.label}>
            <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">{g.label}</div>
            <div className="space-y-2">
              {g.items.map((it) => <ActivityItem key={it.key} item={it} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityItem({ item }) {
  const TONE = {
    create: { ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: 'plus' },
    stage:  { ring: 'ring-sky-500/30',     bg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',         icon: 'trendingUp' },
    status: { ring: 'ring-violet-500/30',  bg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',icon: 'spark' },
    assign: { ring: 'ring-amber-500/30',   bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',  icon: 'userCircle' },
    update: { ring: 'ring-gray-300/40',    bg: 'bg-gray-200/60 dark:bg-slate-700 text-gray-600 dark:text-slate-300', icon: 'cog' },
    escalate:{ring: 'ring-red-500/30',     bg: 'bg-red-500/15 text-red-600 dark:text-red-400',        icon: 'bell' },
    delete: { ring: 'ring-red-500/30',     bg: 'bg-red-500/15 text-red-600 dark:text-red-400',        icon: 'trash' },
    comment:{ ring: 'ring-brand-500/30',   bg: 'bg-brand-500/15 text-brand-600 dark:text-brand-400',  icon: 'document' },
    note:   { ring: 'ring-brand-500/30',   bg: 'bg-brand-500/15 text-brand-600 dark:text-brand-400',  icon: 'document' },
  };
  const tone = TONE[item.tone] || TONE.update;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center ${tone.bg} ring-4 ${tone.ring}`}>
          <Icon name={tone.icon} className="w-3.5 h-3.5" />
        </span>
        <span className="flex-1 w-px bg-gray-100 dark:bg-slate-800 mt-1" />
      </div>

      <div className="flex-1 pb-4">
        <div className="rounded-lg border border-gray-100 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/40 transition p-3 bg-white dark:bg-slate-900/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`badge font-semibold uppercase tracking-wide text-[9px] ${tone.bg}`}>
                  {item.tag}
                </span>
              </div>
              <div className="text-sm text-gray-800 dark:text-slate-200">
                <span className="font-semibold text-brand-700 dark:text-brand-400">{item.actor || 'System'}</span>{' '}
                <span className="text-gray-600 dark:text-slate-300">{item.title}</span>
              </div>
              {item.body && (
                <div className="mt-2 text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap bg-gray-50 dark:bg-slate-800/40 rounded p-2 border border-gray-100 dark:border-slate-800">
                  {item.body}
                </div>
              )}
              {item.attachments?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.attachments.map((a, i) => (
                    <a
                      key={i} href={a.url} target="_blank" rel="noreferrer"
                      className="text-xs text-brand-700 dark:text-brand-400 underline bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1"
                    >
                      📎 {a.original_name || a.filename}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
              {fmtDateTime(item.at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Comments tab ----------------------------- */
function CommentsTab({ ticket, comments, onCommented }) {
  return (
    <div className="space-y-4">
      <ReplyComposer ticketId={ticket.id} onPosted={onCommented} />

      <div className="space-y-3">
        {comments.length === 0 && (
          <div className="text-center text-sm text-gray-500 dark:text-slate-400 py-10">
            No comments yet — start the conversation.
          </div>
        )}
        {comments.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border p-3 ${
              c.is_internal
                ? 'border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-900/20'
                : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Avatar name={c.author_name} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{c.author_name || 'Unknown'}</span>
                    {c.is_internal && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-200 text-amber-900 dark:bg-amber-800/60 dark:text-amber-200">
                        Internal note
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">{c.author_role}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">{fmtDateTime(c.created_at)}</div>
            </div>
            <div className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap mt-2">{c.body}</div>
            {c.attachments?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {c.attachments.map((a, i) => (
                  <a
                    key={i} href={a.url} target="_blank" rel="noreferrer"
                    className="text-xs text-brand-700 dark:text-brand-400 underline bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1"
                  >
                    📎 {a.original_name || a.filename}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReplyComposer({ ticketId, onPosted }) {
  // mode === 'reply'    → public, customer-visible reply
  // mode === 'internal' → internal note (visible only to staff). Tinted amber
  //                       to match the rendered note style and signal "off-record".
  const [mode, setMode]       = useState('reply');
  const [body, setBody]       = useState('');
  const [files, setFiles]     = useState([]);
  const [sending, setSending] = useState(false);
  const taRef = useRef(null);

  const canSend = body.trim().length > 0 || files.length > 0;
  const isInternal = mode === 'internal';

  const send = async (e) => {
    if (e) e.preventDefault();
    if (!canSend) return toast.error('Type a message or attach a file before sending.');
    setSending(true);
    try {
      await ticketsService.addComment(ticketId, body, files, { is_internal: isInternal });
      setBody(''); setFiles([]);
      toast.success(isInternal ? 'Internal note added' : 'Reply sent');
      onPosted?.();
    } catch { toast.error(isInternal ? 'Failed to save note' : 'Failed to send'); }
    finally { setSending(false); }
  };

  return (
    <form
      onSubmit={send}
      className={`rounded-lg border focus-within:ring-2 transition ${
        isInternal
          ? 'border-amber-300 bg-amber-50/70 focus-within:border-amber-400 focus-within:ring-amber-400/30 dark:border-amber-800 dark:bg-amber-900/15'
          : 'border-gray-200 bg-white focus-within:border-brand-400 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      {/* Mode toggle — segmented control */}
      <div className="flex items-center gap-1 px-2 pt-2">
        {[
          { id: 'reply',    label: 'Reply to customer', tone: 'brand' },
          { id: 'internal', label: 'Internal note',     tone: 'amber' },
        ].map((opt) => {
          const active = mode === opt.id;
          const cls = active
            ? (opt.tone === 'amber'
                ? 'bg-amber-200 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100'
                : 'bg-brand-600 text-white')
            : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800';
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${cls}`}
            >
              {opt.label}
            </button>
          );
        })}
        {isInternal && (
          <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-amber-800 dark:text-amber-300">
            Visible to staff only
          </span>
        )}
      </div>
      <textarea
        ref={taRef}
        id="reply-composer"
        className="w-full bg-transparent border-0 px-3 py-2.5 text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none resize-none"
        rows={3}
        placeholder={isInternal
          ? 'Add an internal note (root cause, runbook link, escalation context)…  (Ctrl/⌘ + Enter to save)'
          : 'Write a reply to the customer…  (Ctrl/⌘ + Enter to send)'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(e);
        }}
      />
      <div className="flex items-center justify-between gap-3 px-2 py-2 border-t border-gray-100 dark:border-slate-800">
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 cursor-pointer hover:text-brand-600 dark:hover:text-brand-400">
          <Icon name="document" className="w-4 h-4" />
          <span>{files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'}` : 'Attach'}</span>
          <input
            type="file" multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files))}
          />
        </label>
        <div className="flex items-center gap-2">
          {!canSend && !sending && (
            <span className="text-[11px] text-gray-400 dark:text-slate-500 hidden sm:inline">Type to enable</span>
          )}
          <button
            type="submit"
            disabled={sending || !canSend}
            className={`!py-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              isInternal ? 'btn-secondary' : 'btn-primary'
            }`}
          >
            {sending ? 'Saving…' : (isInternal ? 'Add note' : 'Send')}
          </button>
        </div>
      </div>
    </form>
  );
}

/* =========================================================================
 * RIGHT — Associations
 * =======================================================================*/
function AssociationsColumn({ ticket, comments }) {
  const attachments = useMemo(
    () => comments.flatMap((c) =>
      (c.attachments || []).map((a) => ({ ...a, when: c.created_at, by: c.author_name }))
    ),
    [comments]
  );

  return (
    <aside className="space-y-4">
      <Section title={`Service Projects (${ticket.project_id ? 1 : 0})`} action="Add" open>
        {ticket.project_id ? (
          <div className="rounded-lg border border-gray-100 dark:border-slate-800 p-3 bg-white dark:bg-slate-900/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
              <span className="w-7 h-7 rounded-md bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <Icon name="briefcase" className="w-3.5 h-3.5" />
              </span>
              {ticket.project_name}
              {ticket.project_code && (
                <span className="text-[10px] text-gray-500 dark:text-slate-400 font-normal">· {ticket.project_code}</span>
              )}
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {ticket.customer_name && (
                <KeyValue k="Owner" v={ticket.customer_name} />
              )}
              {ticket.project_manager_name && (
                <KeyValue k="Project Manager" v={ticket.project_manager_name} />
              )}
              {ticket.location_name && (
                <KeyValue k="Location" v={ticket.location_name} />
              )}
            </div>
          </div>
        ) : (
          <Empty hint="No project linked yet." />
        )}
      </Section>

      <Section title={`Attachments (${attachments.length})`} open>
        {attachments.length === 0 ? (
          <Empty hint="See the files attached to your activities or uploaded to this record." />
        ) : (
          <div className="space-y-1.5">
            {attachments.map((a, i) => (
              <a
                key={i} href={a.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-slate-800/40 text-xs"
              >
                <Icon name="document" className="w-3.5 h-3.5 text-gray-400" />
                <span className="flex-1 truncate text-brand-700 dark:text-brand-400 underline">
                  {a.original_name || a.filename}
                </span>
                <span className="text-gray-400 dark:text-slate-500">{fmtDate(a.when)}</span>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Contacts (${ticket.contact_name || ticket.reporter_name ? 1 : 0})`} action="Add" open>
        {ticket.contact_name || ticket.reporter_name ? (
          <div className="rounded-lg border border-gray-100 dark:border-slate-800 p-3 bg-white dark:bg-slate-900/40">
            <div className="flex items-center gap-2">
              <Avatar name={ticket.contact_name || ticket.reporter_name} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                  {ticket.contact_name || ticket.reporter_name}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                  {ticket.contact_email || ticket.reporter_email || ''}
                </div>
              </div>
            </div>
            {(ticket.reporter_phone || ticket.contact_phone) && (
              <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                {ticket.reporter_phone || ticket.contact_phone}
              </div>
            )}
          </div>
        ) : (
          <Empty hint="See the people associated with this record." />
        )}
      </Section>

      <Section title="SLA" open>
        {ticket.sla_due_at ? (
          <div className="text-xs space-y-2">
            <KeyValue k="Priority" v={<Badge value={ticket.priority} />} />
            <KeyValue k="Due" v={
              <span className={isPast(ticket.sla_due_at) && ticket.status !== 'closed'
                ? 'text-red-600 dark:text-red-400 font-medium'
                : 'text-gray-700 dark:text-slate-300'}
              >
                {fmtDateTime(ticket.sla_due_at)}
              </span>
            }/>
            {ticket.escalation_level > 0 && (
              <KeyValue k="Escalation" v={
                <span className="badge bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 font-semibold">
                  Level {ticket.escalation_level}
                </span>
              } />
            )}
          </div>
        ) : (
          <Empty hint="No SLA target set." />
        )}
      </Section>
    </aside>
  );
}

/* =========================================================================
 * Small reusable bits
 * =======================================================================*/
function Section({ title, children, action, open: openProp = true, onToggle }) {
  const [openState, setOpenState] = useState(openProp);
  const open = onToggle ? openProp : openState;
  const toggle = onToggle || (() => setOpenState((v) => !v));

  return (
    <div className="card overflow-hidden">
      <header
        className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-slate-800 cursor-pointer select-none"
        onClick={toggle}
      >
        <div className="flex items-center gap-1.5">
          <Icon name="chevronDown" className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{title}</h3>
        </div>
        {action && (
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
          >
            <Icon name="plus" className="w-3 h-3" /> {action}
          </button>
        )}
      </header>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-28 shrink-0 text-gray-500 dark:text-slate-400">{label}</span>
      <span className="flex-1 text-gray-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function KeyValue({ k, v }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-gray-500 dark:text-slate-400">{k}</span>
      <span className="flex-1 text-gray-800 dark:text-slate-200">{v}</span>
    </div>
  );
}

function Empty({ hint }) {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon name="document" className="w-5 h-5 text-gray-400 dark:text-slate-500" />
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed px-2">{hint}</p>
    </div>
  );
}

function PersonChip({ name, email }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar name={name} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{name}</div>
        {email && <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{email}</div>}
      </div>
    </div>
  );
}

function Avatar({ name = '?' }) {
  const initials = String(name).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <span className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-[11px] font-semibold flex items-center justify-center shadow-sm">
      {initials}
    </span>
  );
}

/* =========================================================================
 * Helpers
 * =======================================================================*/
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}
function isPast(d) {
  if (!d) return false;
  return new Date(d).getTime() < Date.now();
}

const ACTION_RENDER = {
  'ticket.create':  () => ({ tag: 'Created',     tone: 'create',   verb: 'created this ticket.' }),
  'ticket.update':  () => ({ tag: 'Updated',     tone: 'update',   verb: 'updated ticket details.' }),
  'ticket.stage':   (m) => ({
    tag: 'Stage',  tone: 'stage',
    verb: m?.stage ? `moved this ticket to ${m.stage}.` : 'changed the stage.',
  }),
  'ticket.status':  (m) => ({
    tag: 'Status', tone: 'status',
    verb: m?.status ? `changed status to ${m.status}.` : 'changed the status.',
  }),
  'ticket.assign':  () => ({ tag: 'Assigned',    tone: 'assign',   verb: 'assigned the ticket.' }),
  'ticket.escalate':(m) => ({ tag: 'Escalated',  tone: 'escalate', verb: `escalated to Level ${m?.level ?? '?'}.` }),
  'ticket.delete':  () => ({ tag: 'Deleted',     tone: 'delete',   verb: 'deleted this ticket.' }),
  'ticket.comment': () => ({ tag: 'Comment',     tone: 'comment',  verb: 'added a comment.' }),
};

function buildTimeline(activity, comments) {
  const items = [];

  for (const a of activity) {
    const r = ACTION_RENDER[a.action]?.(a.meta) || { tag: a.action, tone: 'update', verb: a.action };
    items.push({
      key: `a-${a.id}`,
      type: 'audit',
      action: a.action,
      tag: r.tag,
      tone: r.tone,
      title: r.verb,
      actor: a.user_name || 'System',
      at: a.created_at,
      body: null,
    });
  }
  for (const c of comments) {
    items.push({
      key: `c-${c.id}`,
      type: 'note',
      action: 'note',
      tag: 'Note',
      tone: 'note',
      title: 'left a note',
      actor: c.author_name || 'Unknown',
      at: c.created_at,
      body: c.body,
      attachments: c.attachments,
    });
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function groupByMonth(items) {
  const buckets = new Map();
  for (const it of items) {
    const d = new Date(it.at);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    if (!buckets.has(key)) buckets.set(key, { label, items: [] });
    buckets.get(key).items.push(it);
  }
  return Array.from(buckets.values());
}
