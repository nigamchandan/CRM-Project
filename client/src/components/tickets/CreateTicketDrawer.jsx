import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as ticketsService from '../../services/ticketsService';
import * as pipelinesService from '../../services/ticketPipelinesService';
import * as projectsService from '../../services/projectsService';
import * as usersService from '../../services/usersService';
import * as contactsService from '../../services/contactsService';
import * as workloadService from '../../services/workloadService';
import api from '../../services/api';
import { ProjectFormModal } from '../../pages/Settings.jsx';
import { useAuth } from '../../context/AuthContext';

/* ────────────────────────────────────────────────────────────────────────────
 *  HubSpot-style Create Ticket slide-over.
 *  Mirrors the reference screenshots: ticket name, pipeline, stage, source,
 *  ticket owner (engineer), select project manager, priority + a Contacts
 *  association block and a Service Projects (= our `projects`) block.
 * ───────────────────────────────────────────────────────────────────────── */

const SOURCE_OPTIONS = [
  { value: 'phone',  label: 'Phone' },
  { value: 'email',  label: 'Email' },
  { value: 'portal', label: 'Customer Portal' },
  { value: 'chat',   label: 'Chat' },
  { value: 'api',    label: 'API / Integration' },
  { value: 'other',  label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low',     dot: 'bg-gray-400' },
  { value: 'medium',   label: 'Medium',  dot: 'bg-amber-400' },
  { value: 'high',     label: 'High',    dot: 'bg-orange-500' },
  { value: 'critical', label: 'Urgent',  dot: 'bg-red-500' },
];

const EMPTY_FORM = {
  subject: '',
  pipeline_id: '',
  pipeline_stage_id: '',
  description: '',
  source: '',
  ticket_type: 'incident',         // ITIL: incident (something broken) | request (something wanted)
  assigned_engineer_id: '',
  project_manager_id: '',          // override
  priority: 'medium',
  contact_id: '',
  project_id: '',                  // "Service Projects" association
  reporter_name: '',
  reporter_email: '',
  reporter_phone: '',
};

export default function CreateTicketDrawer({ open, onClose, onCreated, defaultProjectId }) {
  const { user } = useAuth();
  const canCreateProject = user?.role === 'admin' || user?.role === 'manager';
  const [form, setForm]           = useState(EMPTY_FORM);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages]       = useState([]);
  const [users, setUsers]         = useState([]);
  const [projects, setProjects]   = useState([]);
  const [contacts, setContacts]   = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving]       = useState(false);
  const [newProjOpen, setNewProjOpen] = useState(false);

  // Locations are only needed for the inline "+ New project" modal — fetch
  // them lazily the first time the modal opens to avoid an extra request on
  // every drawer mount.
  useEffect(() => {
    if (!newProjOpen || locations.length) return;
    api.get('/locations')
      .then((r) => setLocations(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {});
  }, [newProjOpen, locations.length]);

  /* ----------------------------------------------------------------- load */
  useEffect(() => {
    if (!open) return;
    Promise.all([
      pipelinesService.listPipelines({ active: true }),
      usersService.list({ limit: 200 }),
      projectsService.list({ active: true }),
      contactsService.list({ limit: 200 }),
    ]).then(([pl, us, pr, co]) => {
      setPipelines(pl || []);
      setUsers((us?.data ?? us) || []);
      setProjects(pr || []);
      setContacts((co?.data ?? co) || []);
      const def = (pl || []).find(p => p.is_default) || (pl || [])[0];
      setForm((f) => ({
        ...f,
        pipeline_id: def?.id || '',
        assigned_engineer_id: f.assigned_engineer_id || (user?.id ?? ''),
        project_id: defaultProjectId || f.project_id || '',
      }));
    }).catch(() => {});
  }, [open, defaultProjectId, user?.id]);

  /* load stages whenever pipeline changes — auto-select first stage */
  useEffect(() => {
    if (!form.pipeline_id) { setStages([]); return; }
    pipelinesService.listStages(form.pipeline_id).then((rows) => {
      setStages(rows || []);
      setForm((f) => ({
        ...f,
        pipeline_stage_id: rows?.[0]?.id || '',
      }));
    }).catch(() => setStages([]));
  }, [form.pipeline_id]);

  /* whenever project changes, prefill the project's default PM into "Select Project Manager" */
  useEffect(() => {
    if (!form.project_id) return;
    const proj = projects.find(p => String(p.id) === String(form.project_id));
    if (proj?.project_manager_id) {
      setForm((f) => ({ ...f, project_manager_id: f.project_manager_id || proj.project_manager_id }));
    }
  }, [form.project_id, projects]);

  /* ---- engineers (excluding admins) for the Owner dropdown ---- */
  const engineers = useMemo(
    () => (users || []).filter(u => ['engineer', 'manager', 'admin'].includes(u.role)),
    [users]
  );
  const projectManagers = useMemo(
    () => (users || []).filter(u => ['manager', 'admin', 'project_manager'].includes(u.role)),
    [users]
  );

  /* whichever stages we currently have, this shows them as colored chips in the dropdown */
  const stageOptions = useMemo(
    () => stages.map(s => ({
      value: s.id, label: s.name, color: s.color || '#6b7280', is_paused: s.is_sla_paused,
    })),
    [stages]
  );

  /* ------------------------------------------------------------- save */
  const submit = async (createAnother) => {
    if (!form.subject.trim())     return toast.error('Ticket name is required');
    if (!form.pipeline_id)        return toast.error('Pick a pipeline');
    if (!form.pipeline_stage_id)  return toast.error('Pick a ticket status');
    if (!form.description.trim()) return toast.error('Description is required');
    if (!form.source)             return toast.error('Source is required');
    if (!form.assigned_engineer_id) return toast.error('Ticket owner is required');

    setSaving(true);
    try {
      const payload = {
        subject:               form.subject.trim(),
        description:           form.description.trim(),
        priority:              form.priority,
        ticket_type:           form.ticket_type,
        pipeline_id:           Number(form.pipeline_id),
        pipeline_stage_id:     Number(form.pipeline_stage_id),
        source:                form.source,
        assigned_engineer_id:  Number(form.assigned_engineer_id) || null,
        project_manager_id:    form.project_manager_id ? Number(form.project_manager_id) : null,
        project_id:            form.project_id ? Number(form.project_id) : null,
        contact_id:            form.contact_id ? Number(form.contact_id) : null,
        reporter_name:         form.reporter_name || null,
        reporter_email:        form.reporter_email || null,
        reporter_phone:        form.reporter_phone || null,
      };
      const created = await ticketsService.create(payload);
      toast.success(`Ticket ${created.ticket_no || `#${created.id}`} created`);
      onCreated?.(created);
      if (createAnother) {
        setForm({ ...EMPTY_FORM,
          pipeline_id: form.pipeline_id,
          pipeline_stage_id: form.pipeline_stage_id,
          assigned_engineer_id: form.assigned_engineer_id,
          source: form.source,
        });
      } else {
        onClose?.();
        setForm(EMPTY_FORM);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col
                   border-l border-gray-200 dark:border-slate-700 animate-[slideIn_.18s_ease-out]"
        style={{ animationName: 'slideIn' }}
      >
        {/* HEADER — matches HubSpot's teal gradient bar */}
        <header
          className="px-5 py-4 flex items-center justify-between
                     bg-gradient-to-r from-teal-500 to-emerald-500 text-white"
        >
          <h2 className="font-semibold text-lg">Create Ticket</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none" aria-label="Close">×</button>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm
                        text-gray-800 dark:text-slate-200">

          {/* Ticket name */}
          <Field label="Ticket name" required>
            <input
              className="hs-input"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Short summary, e.g. The recon log size is increasing continuously."
              autoFocus
            />
          </Field>

          {/* Pipeline */}
          <Field label="Pipeline" required>
            <select className="hs-input"
                    value={form.pipeline_id}
                    onChange={(e) => setForm((f) => ({ ...f, pipeline_id: e.target.value }))}>
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          {/* Ticket status / stage */}
          <Field label="Ticket status" required>
            <StagePicker
              value={form.pipeline_stage_id}
              options={stageOptions}
              onChange={(v) => setForm((f) => ({ ...f, pipeline_stage_id: v }))}
            />
          </Field>

          {/* Description */}
          <Field label="Ticket description" required>
            <textarea
              className="hs-input min-h-[96px]"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the issue, steps to reproduce, impact, etc."
            />
          </Field>

          {/* Source */}
          <Field label="Source" required hint="How did you find out about this issue?">
            <select className="hs-input"
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
              <option value="">Select…</option>
              {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          {/* Reporter (only useful when no contact picked yet) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reporter name">
              <input className="hs-input"
                     value={form.reporter_name}
                     onChange={(e) => setForm((f) => ({ ...f, reporter_name: e.target.value }))}
                     placeholder="Caller / sender" />
            </Field>
            <Field label="Reporter phone">
              <input className="hs-input"
                     value={form.reporter_phone}
                     onChange={(e) => setForm((f) => ({ ...f, reporter_phone: e.target.value }))}
                     placeholder="+91-…" />
            </Field>
          </div>
          <Field label="Reporter email">
            <input className="hs-input" type="email"
                   value={form.reporter_email}
                   onChange={(e) => setForm((f) => ({ ...f, reporter_email: e.target.value }))}
                   placeholder="reporter@example.com" />
          </Field>

          {/* Owner */}
          <Field label="Ticket owner" required>
            <div className="flex items-center gap-2">
              <select className="hs-input flex-1"
                      value={form.assigned_engineer_id}
                      onChange={(e) => setForm((f) => ({ ...f, assigned_engineer_id: e.target.value }))}>
                <option value="">Select…</option>
                {engineers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.email ? ` — ${u.email}` : ''}
                  </option>
                ))}
              </select>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <SuggestLeastLoadedButton
                  excludeId={form.assigned_engineer_id}
                  onPick={(picked) => {
                    if (!picked) return toast('No engineer available right now', { icon: 'ℹ️' });
                    setForm((f) => ({ ...f, assigned_engineer_id: String(picked.id) }));
                    toast.success(`Assigned to ${picked.name} (load ${picked.load_score?.toFixed?.(1) ?? '0'})`);
                  }}
                />
              )}
            </div>
          </Field>

          {/* Project Manager (override) */}
          <Field label="Select Project Manager"
                 hint="Defaults to the project's PM if a project is associated">
            <select className="hs-input"
                    value={form.project_manager_id}
                    onChange={(e) => setForm((f) => ({ ...f, project_manager_id: e.target.value }))}>
              <option value="">No owner</option>
              {projectManagers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>

          {/* Priority */}
          <Field label="Priority" required>
            <PriorityPicker
              value={form.priority}
              onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            />
          </Field>

          {/* Ticket type — ITIL classification (incident vs request) */}
          <Field label="Ticket type"
                 hint="Incident: something is broken. Request: someone wants something.">
            <div className="flex gap-2">
              {[
                { value: 'incident', label: 'Incident', tone: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-800',
                  activeTone: 'bg-rose-600 text-white ring-rose-600' },
                { value: 'request',  label: 'Request',  tone: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-800',
                  activeTone: 'bg-sky-600 text-white ring-sky-600' },
              ].map((o) => {
                const active = form.ticket_type === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, ticket_type: o.value }))}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ring-1 transition ${active ? o.activeTone : o.tone + ' hover:brightness-95'}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* ---------- Associations ---------- */}
          <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mt-4 mb-2">
              Associate Ticket with
            </h3>

            {/* Contacts */}
            <Section title="Contacts">
              <Field label="Associate records">
                <select className="hs-input"
                        value={form.contact_id}
                        onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value }))}>
                  <option value="">Search…</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company ? ` — ${c.company}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>

            {/* Service Projects (= projects in our schema) */}
            <Section title="Service Projects" required>
              <Field label="Associate records" required>
                <select className="hs-input"
                        value={form.project_id}
                        onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}>
                  <option value="">Search…</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.location_code ? ` — ${p.location_code}` : ''}
                    </option>
                  ))}
                </select>
                {canCreateProject && (
                  <button
                    type="button"
                    onClick={() => setNewProjOpen(true)}
                    className="mt-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    + Create new project
                  </button>
                )}
              </Field>
            </Section>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="px-5 py-3 border-t border-gray-200 dark:border-slate-700
                            bg-gray-50 dark:bg-slate-900/60 flex items-center gap-3">
          <button
            disabled={saving}
            onClick={() => submit(false)}
            className="px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-semibold
                       disabled:opacity-60 transition"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
          <button
            disabled={saving}
            onClick={() => submit(true)}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-slate-600
                       hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 transition"
          >
            Create and add another
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-md border border-orange-300 text-orange-600
                       hover:bg-orange-50 dark:hover:bg-orange-500/10 transition"
          >
            Cancel
          </button>
        </footer>
      </aside>

      {/* keyframes for the slide-in animation */}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      {/* Inline "+ Create new project" modal — auto-selects the new project when saved */}
      <ProjectFormModal
        open={newProjOpen}
        project={null}
        users={users}
        locations={locations}
        onClose={() => setNewProjOpen(false)}
        onSaved={(saved) => {
          setNewProjOpen(false);
          if (saved?.id) {
            setProjects((prev) => {
              const without = prev.filter((p) => p.id !== saved.id);
              return [saved, ...without].sort((a, b) => a.name.localeCompare(b.name));
            });
            setForm((f) => ({ ...f, project_id: String(saved.id) }));
          } else {
            // Fallback: refetch the list if the API didn't echo the row back.
            projectsService.list({ active: true }).then(setProjects).catch(() => {});
          }
        }}
      />
    </div>
  );
}

/* ---------- small helpers ---------- */

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function Section({ title, required, children }) {
  return (
    <details
      open
      className="rounded-lg border border-gray-200 dark:border-slate-700 mb-3 bg-gray-50/50 dark:bg-slate-800/40"
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold
                          text-gray-800 dark:text-slate-100 flex items-center gap-1">
        <span className="text-gray-500 dark:text-slate-400 mr-1">▾</span>
        {title}
        {required && <span className="text-red-500">*</span>}
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-3">{children}</div>
    </details>
  );
}

function StagePicker({ value, options, onChange }) {
  return (
    <select className="hs-input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}{o.is_paused ? '  •  (SLA paused)' : ''}
        </option>
      ))}
    </select>
  );
}

function PriorityPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PRIORITY_OPTIONS.map(p => (
        <button
          type="button"
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-left transition
            ${value === p.value
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 dark:border-teal-400'
              : 'border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'}
          `}
        >
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.dot}`} />
          <span className="text-sm">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Asks the workload service for the least-loaded engineer (optionally
 * excluding whoever is already selected) and hands the result back via
 * `onPick`. Renders a compact secondary button so it tucks neatly next
 * to the engineer picker.
 */
function SuggestLeastLoadedButton({ excludeId, onPick }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    try {
      const r = await workloadService.suggest({
        exclude_id: excludeId || undefined,
      });
      onPick(r?.user || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not fetch workload');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      title="Auto-assign to the engineer with the smallest open queue"
      className="px-2.5 py-2 text-xs font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
    >
      {busy ? '…' : 'Suggest'}
    </button>
  );
}
