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
import Icon from '../ui/Icon.jsx';

/* ────────────────────────────────────────────────────────────────────────────
 *  Create-Ticket Wizard (3 steps)
 *
 *    Step 1  Smart Basics      → title, type, priority, category, description
 *    Step 2  Assignment        → site, engineer, manager, escalation, reporter
 *    Step 3  Review & SLA      → SLA countdown, impact, auto-tags, summary
 *
 *  Built around the existing /api/tickets contract — no backend changes
 *  required.  The smart bits (priority/category/duplicate detection) are
 *  pure-frontend heuristics so they fail gracefully.
 *
 *  Two entry points are exported:
 *    <CreateTicketDrawer />       full wizard (default export)
 *    <QuickTicketButton />        floating mini-modal for fast captures
 * ───────────────────────────────────────────────────────────────────────── */

const STEPS = [
  { id: 1, label: 'Basics',     icon: 'sparkles',    desc: 'Title, type, priority' },
  { id: 2, label: 'Assignment', icon: 'users',       desc: 'Site, owner, manager' },
  { id: 3, label: 'Review',     icon: 'checkCircle', desc: 'SLA & confirmation' },
];

const SOURCE_OPTIONS = [
  { value: 'phone',  label: 'Phone' },
  { value: 'email',  label: 'Email' },
  { value: 'portal', label: 'Customer Portal' },
  { value: 'chat',   label: 'Chat' },
  { value: 'api',    label: 'API / Integration' },
  { value: 'other',  label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low',      dot: 'bg-gray-400'    },
  { value: 'medium',   label: 'Medium',   dot: 'bg-amber-400'   },
  { value: 'high',     label: 'High',     dot: 'bg-orange-500'  },
  { value: 'critical', label: 'Urgent',   dot: 'bg-red-500'     },
];

// Hours until SLA breach by priority — kept locally so the live countdown
// stays snappy. Matches DEFAULT_POLICY in server/services/sla.service.js.
const PRIORITY_HOURS = { critical: 4, high: 8, medium: 24, low: 72 };

const TITLE_SUGGESTIONS = [
  'Server / system not reachable',
  'Application is slow or hanging',
  'Printer / hardware failure',
  'Account or permission request',
  'Network connectivity issue',
];

const DESC_TEMPLATES = [
  { id: 'down', label: 'System down',
    text: 'System is unreachable since [time].\n\nWho is affected: [team / site]\nBusiness impact: [describe]\nRecent changes: [deploys / config / power]' },
  { id: 'perf', label: 'Performance issue',
    text: 'Performance degraded since [time].\n\nObserved: [slowness / timeouts]\nFrequency: [intermittent / constant]\nUsers affected: [who / how many]' },
  { id: 'hw',   label: 'Hardware failure',
    text: 'Hardware: [model / asset tag]\nSymptom: [no power / errors]\nLocation: [building / desk]\nUrgency: [immediate / can wait]' },
  { id: 'req',  label: 'Access / request',
    text: 'Requested by: [name]\nResource: [system / shared drive / app]\nReason: [purpose]\nNeeded by: [date]' },
];

const IMPACT_OPTIONS = [
  { id: 'single', label: 'Single user',  hint: 'Just one person blocked',     icon: 'userCircle' },
  { id: 'team',   label: 'Team',         hint: 'A group is impacted',         icon: 'users' },
  { id: 'site',   label: 'Entire site',  hint: 'Site / location-wide outage', icon: 'globe' },
];

/* ---------- heuristics ---------- */

// Map free-form text to a suggested priority. Conservative defaults so we
// don't over-escalate; user can always override.
function inferPriority(text) {
  const s = String(text || '').toLowerCase();
  if (/\b(down|outage|not working|crashed?|broken|critical|urgent|p1|emergency|fire|panic|breach)\b/.test(s)) {
    return { value: 'high', reason: 'detected outage / "not working" language' };
  }
  if (/\b(slow|delay|sluggish|lag|laggy|timeout|hanging)\b/.test(s)) {
    return { value: 'medium', reason: 'performance keywords detected' };
  }
  return { value: 'medium', reason: 'no urgency signal — adjust if needed' };
}

function inferCategory(text) {
  const s = String(text || '').toLowerCase();
  if (/\b(network|wifi|wi-fi|vpn|connectivity|router|dns|firewall|switch|lan)\b/.test(s)) return 'Network';
  if (/\b(security|password|breach|phishing|virus|malware|access|permission|2fa)\b/.test(s)) return 'Security';
  if (/\b(printer|laptop|mouse|keyboard|monitor|hardware|disk|memory|ram|cpu|battery|hard\s*drive)\b/.test(s)) return 'Hardware';
  if (/\b(app|application|crash|error|login|portal|website|site)\b/.test(s)) return 'Application';
  return null;
}

const EMPTY_FORM = {
  subject: '',
  pipeline_id: '',
  pipeline_stage_id: '',
  description: '',
  source: '',
  ticket_type: 'incident',
  assigned_engineer_id: '',
  project_manager_id: '',
  priority: 'medium',
  contact_id: '',
  project_id: '',
  reporter_name: '',
  reporter_email: '',
  reporter_phone: '',
};

/* ====================================================================== */
/*                        FULL 3-STEP WIZARD DRAWER                       */
/* ====================================================================== */

export default function CreateTicketDrawer({ open, onClose, onCreated, defaultProjectId }) {
  const { user } = useAuth();
  const canCreateProject = user?.role === 'admin' || user?.role === 'manager';

  /* ----- form + UI state ----- */
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [escalateNow, setEscalateNow]         = useState(false);
  const [impact, setImpact]                   = useState('single');
  const [priorityOverridden, setPriorityOver] = useState(false);
  const [duplicates, setDuplicates]           = useState([]);

  /* ----- async data ----- */
  const [pipelines, setPipelines] = useState([]);
  const [stages,    setStages]    = useState([]);
  const [users,     setUsers]     = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [contacts,  setContacts]  = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving,     setSaving]    = useState(false);
  const [newProjOpen, setNewProjOpen] = useState(false);

  // Reset wizard whenever it re-opens — but keep the lists we already loaded.
  useEffect(() => {
    if (open) {
      setStep(1);
      setEscalateNow(false);
      setImpact('single');
      setPriorityOver(false);
      setDuplicates([]);
    }
  }, [open]);

  /* ----- bootstrap ----- */
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

  // locations are only needed by the inline "+ New project" modal
  useEffect(() => {
    if (!newProjOpen || locations.length) return;
    api.get('/locations')
      .then((r) => setLocations(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {});
  }, [newProjOpen, locations.length]);

  // load stages whenever pipeline changes
  useEffect(() => {
    if (!form.pipeline_id) { setStages([]); return; }
    pipelinesService.listStages(form.pipeline_id).then((rows) => {
      setStages(rows || []);
      setForm((f) => ({ ...f, pipeline_stage_id: rows?.[0]?.id || '' }));
    }).catch(() => setStages([]));
  }, [form.pipeline_id]);

  // when project changes, prefill the project's PM
  useEffect(() => {
    if (!form.project_id) return;
    const proj = projects.find(p => String(p.id) === String(form.project_id));
    if (proj?.project_manager_id) {
      setForm((f) => ({ ...f, project_manager_id: f.project_manager_id || proj.project_manager_id }));
    }
  }, [form.project_id, projects]);

  // smart priority — only auto-update while user hasn't manually picked
  useEffect(() => {
    if (priorityOverridden) return;
    const text = `${form.subject} ${form.description}`;
    if (text.trim().length < 4) return;
    const sug = inferPriority(text);
    setForm((f) => (f.priority === sug.value ? f : { ...f, priority: sug.value }));
  }, [form.subject, form.description, priorityOverridden]);

  // duplicate detection — debounced full-text search
  useEffect(() => {
    const q = form.subject.trim();
    if (q.length < 6) { setDuplicates([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await ticketsService.list({ search: q.slice(0, 80), limit: 5 });
        const rows = r?.data || r || [];
        // Keep only open / in-progress dupes — closed tickets are noise.
        setDuplicates(
          rows
            .filter((t) => t.status !== 'closed' && t.status !== 'resolved')
            .slice(0, 3)
        );
      } catch { /* duplicate detection is best-effort */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.subject]);

  /* ----- derived ----- */
  const engineers = useMemo(
    () => (users || []).filter(u => ['engineer', 'manager', 'admin'].includes(u.role)),
    [users]
  );
  const projectManagers = useMemo(
    () => (users || []).filter(u => ['manager', 'admin', 'project_manager'].includes(u.role)),
    [users]
  );
  const stageOptions = useMemo(
    () => stages.map(s => ({
      value: s.id, label: s.name, color: s.color || '#6b7280', is_paused: s.is_sla_paused,
    })),
    [stages]
  );
  const selectedProject  = useMemo(
    () => projects.find(p => String(p.id) === String(form.project_id)) || null,
    [projects, form.project_id]
  );
  const selectedEngineer = useMemo(
    () => users.find(u => String(u.id) === String(form.assigned_engineer_id)) || null,
    [users, form.assigned_engineer_id]
  );
  const selectedManager  = useMemo(
    () => users.find(u => String(u.id) === String(form.project_manager_id)) || null,
    [users, form.project_manager_id]
  );

  const inferredPriority = useMemo(
    () => inferPriority(`${form.subject} ${form.description}`),
    [form.subject, form.description]
  );
  const inferredCategory = useMemo(
    () => inferCategory(`${form.subject} ${form.description}`),
    [form.subject, form.description]
  );

  const effectivePriority = escalateNow ? 'critical' : form.priority;
  const slaHours          = PRIORITY_HOURS[effectivePriority] || 24;

  // Auto-generated tag chips for the summary screen
  const autoTags = useMemo(() => {
    const tags = [];
    if (inferredCategory) tags.push(inferredCategory.toLowerCase());
    if (effectivePriority === 'high' || effectivePriority === 'critical') tags.push('urgent');
    if (selectedProject?.location_code) tags.push(`site-${slug(selectedProject.location_code)}`);
    else if (selectedProject?.location_name) tags.push(`site-${slug(selectedProject.location_name)}`);
    if (form.ticket_type === 'request') tags.push('request');
    return tags;
  }, [inferredCategory, effectivePriority, selectedProject, form.ticket_type]);

  /* ----- step gating ----- */
  const errStep1 = (() => {
    if (form.subject.trim().length < 4)     return 'Add a clear, short title';
    if (!form.pipeline_id)                  return 'Pick a pipeline';
    if (!form.pipeline_stage_id)            return 'Pick a status';
    if (form.description.trim().length < 4) return 'Add a description';
    if (!form.source)                       return 'How was this reported?';
    return null;
  })();
  const errStep2 = (() => {
    if (!form.assigned_engineer_id) return 'Pick the ticket owner';
    return null;
  })();
  const canProceed = step === 1 ? !errStep1 : step === 2 ? !errStep2 : true;

  /* ----- actions ----- */
  const submit = async (createAnother) => {
    if (errStep1) { setStep(1); return toast.error(errStep1); }
    if (errStep2) { setStep(2); return toast.error(errStep2); }

    setSaving(true);
    try {
      // Surface impact + escalation in the body so reviewers see context
      // even though we don't have dedicated columns yet.
      const impactMeta = `\n\n— Impact: ${IMPACT_OPTIONS.find(i => i.id === impact)?.label}` +
                         (escalateNow ? ' · Escalated immediately' : '') +
                         (autoTags.length ? `\n— Tags: ${autoTags.join(', ')}` : '');
      const description = form.description.trim() + impactMeta;

      const payload = {
        subject:               form.subject.trim(),
        description,
        priority:              effectivePriority,
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

      const ownerName = selectedEngineer?.name || 'unassigned';
      const ticketRef = created.ticket_no || `#${created.id}`;
      toast.success(`Ticket ${ticketRef} created · assigned to ${ownerName}`, { duration: 4000 });

      onCreated?.(created);

      if (createAnother) {
        // Preserve the pipeline + status + assignment to fly through batch entry
        setForm({ ...EMPTY_FORM,
          pipeline_id:          form.pipeline_id,
          pipeline_stage_id:    form.pipeline_stage_id,
          assigned_engineer_id: form.assigned_engineer_id,
          source:               form.source,
          project_id:           form.project_id,
        });
        setStep(1);
        setPriorityOver(false);
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[560px]
                   bg-white dark:bg-[#0f0f1a] shadow-2xl flex flex-col
                   border-l border-gray-200 dark:border-slate-800/80
                   animate-[slideIn_.18s_ease-out]"
        style={{ animationName: 'slideIn' }}
      >
        {/* Header — brand gradient, matches new design system */}
        <header className="px-5 py-4 flex items-center justify-between
                           bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
              <Icon name="ticket" className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-semibold text-base leading-tight">Create Ticket</h2>
              <p className="text-[11px] text-white/80 leading-tight">{STEPS[step - 1].desc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* Stepper */}
        <Stepper step={step} onJump={(s) => {
          // Allow free backward nav, forward only if prior steps are valid
          if (s < step) return setStep(s);
          if (s === 2 && !errStep1) return setStep(2);
          if (s === 3 && !errStep1 && !errStep2) return setStep(3);
        }} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-800 dark:text-slate-200">
          {step === 1 && (
            <StepBasics
              form={form}
              setForm={setForm}
              pipelines={pipelines}
              stageOptions={stageOptions}
              inferredPriority={inferredPriority}
              inferredCategory={inferredCategory}
              priorityOverridden={priorityOverridden}
              onPriorityChange={(v) => { setForm((f) => ({ ...f, priority: v })); setPriorityOver(true); }}
              duplicates={duplicates}
            />
          )}
          {step === 2 && (
            <StepAssignment
              form={form}
              setForm={setForm}
              user={user}
              engineers={engineers}
              projectManagers={projectManagers}
              projects={projects}
              contacts={contacts}
              selectedProject={selectedProject}
              selectedEngineer={selectedEngineer}
              selectedManager={selectedManager}
              escalateNow={escalateNow}
              setEscalateNow={setEscalateNow}
              canCreateProject={canCreateProject}
              openCreateProject={() => setNewProjOpen(true)}
            />
          )}
          {step === 3 && (
            <StepReview
              form={form}
              effectivePriority={effectivePriority}
              slaHours={slaHours}
              impact={impact}
              setImpact={setImpact}
              autoTags={autoTags}
              selectedProject={selectedProject}
              selectedEngineer={selectedEngineer}
              selectedManager={selectedManager}
              escalateNow={escalateNow}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-gray-200 dark:border-slate-800/70
                          bg-gray-50/80 dark:bg-slate-900/60 flex items-center gap-3">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-secondary !px-3"
              disabled={saving}
            >
              <Icon name="arrowLeft" className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <button onClick={onClose} className="btn-ghost !px-3" disabled={saving}>Cancel</button>
          )}

          <span className="ml-auto text-[11px] text-gray-500 dark:text-slate-500">
            Step {step} of 3
          </span>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed}
              className="btn-primary"
              title={!canProceed ? (step === 1 ? errStep1 : errStep2) : 'Continue'}
            >
              Continue <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button
                onClick={() => submit(true)}
                disabled={saving}
                className="btn-secondary"
                title="Create and immediately start another"
              >
                Create &amp; add another
              </button>
              <button
                onClick={() => submit(false)}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Creating…' : (
                  <>
                    Create ticket <Icon name="checkCircle" className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </>
          )}
        </footer>
      </aside>

      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

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
            projectsService.list({ active: true }).then(setProjects).catch(() => {});
          }
        }}
      />
    </div>
  );
}

/* ====================================================================== */
/*                              STEPPER                                   */
/* ====================================================================== */

function Stepper({ step, onJump }) {
  return (
    <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-800/70
                    bg-gray-50/60 dark:bg-slate-900/40">
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => {
          const isActive = s.id === step;
          const isDone   = s.id < step;
          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onJump(s.id)}
                className={`group flex items-center gap-2 min-w-0 ${isActive || isDone ? '' : 'opacity-60'}`}
              >
                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ring-1 transition-all
                  ${isActive
                    ? 'bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] text-white ring-white/40 shadow-[0_0_0_4px_rgba(139,92,246,0.18)]'
                    : isDone
                      ? 'bg-emerald-500 text-white ring-emerald-500/30'
                      : 'bg-white text-gray-500 ring-gray-300 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'}`}>
                  {isDone ? <Icon name="checkCircle" className="w-3.5 h-3.5" /> : s.id}
                </span>
                <div className="min-w-0 hidden sm:block">
                  <div className={`text-[12px] font-semibold leading-tight ${isActive ? 'text-gray-900 dark:text-slate-100' : 'text-gray-600 dark:text-slate-400'}`}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-slate-500 leading-tight truncate">
                    {s.desc}
                  </div>
                </div>
              </button>
              {idx < STEPS.length - 1 && (
                <span className={`mx-2 flex-1 h-[2px] rounded
                  ${s.id < step
                    ? 'bg-emerald-500'
                    : s.id === step
                      ? 'bg-gradient-to-r from-[#8b5cf6] to-transparent'
                      : 'bg-gray-200 dark:bg-slate-800'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ====================================================================== */
/*                            STEP 1 — BASICS                              */
/* ====================================================================== */

function StepBasics({
  form, setForm, pipelines, stageOptions,
  inferredPriority, inferredCategory,
  priorityOverridden, onPriorityChange,
  duplicates,
}) {
  return (
    <div className="space-y-5">
      {/* Title with quick-fill chips */}
      <SmartCard icon="sparkles" title="What happened?" subtitle="A short, scannable title gets faster routing.">
        <Field label="Title" required>
          <input
            className="hs-input"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder='e.g. "Printer not working at Chennai site"'
            autoFocus
          />
        </Field>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {TITLE_SUGGESTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((f) => ({ ...f, subject: t }))}
              className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-slate-700
                         bg-white dark:bg-slate-800/50 hover:border-brand-400 hover:bg-brand-50/40
                         dark:hover:bg-brand-500/10 transition text-gray-700 dark:text-slate-300"
            >
              {t}
            </button>
          ))}
        </div>

        {duplicates.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10
                          dark:border-amber-500/30 px-3 py-2 text-[12px]
                          text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <Icon name="bell" className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold mb-0.5">
                Similar issue already reported ({duplicates.length})
              </div>
              <ul className="space-y-0.5">
                {duplicates.map((d) => (
                  <li key={d.id} className="truncate">
                    <span className="font-mono text-[11px] mr-1.5">{d.ticket_no || `#${d.id}`}</span>
                    {d.subject}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SmartCard>

      {/* Type + Priority + Category */}
      <SmartCard icon="target" title="Classification" subtitle="We've pre-filled this from your title — override anytime.">
        <Field label="Ticket type" hint="Incident: something is broken. Request: someone wants something.">
          <div className="flex gap-2">
            {[
              { value: 'incident', label: 'Incident', tone: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
                activeTone: 'bg-rose-600 text-white ring-rose-600' },
              { value: 'request',  label: 'Request',  tone: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
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

        <Field
          label="Priority"
          hint={
            !priorityOverridden && form.subject.trim().length >= 4
              ? `Suggested: ${capitalize(inferredPriority.value)} — ${inferredPriority.reason}`
              : 'Pick the urgency level'
          }
        >
          <PriorityPicker value={form.priority} onChange={onPriorityChange} />
        </Field>

        {inferredCategory && (
          <div className="text-[11px] text-gray-600 dark:text-slate-400 flex items-center gap-1.5 -mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <span>Category detected: <span className="font-semibold text-gray-800 dark:text-slate-200">{inferredCategory}</span></span>
          </div>
        )}
      </SmartCard>

      {/* Description with quick templates */}
      <SmartCard icon="document" title="Describe the issue" subtitle="Tap a template to scaffold a clear write-up.">
        <Field label="Description" required>
          <textarea
            className="hs-input min-h-[120px]"
            rows={5}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe issue clearly — what, where, impact"
          />
        </Field>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {DESC_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, description: t.text }))}
              className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-slate-700
                         bg-white dark:bg-slate-800/50 hover:border-brand-400 hover:bg-brand-50/40
                         dark:hover:bg-brand-500/10 transition text-gray-700 dark:text-slate-300"
            >
              {t.label}
            </button>
          ))}
        </div>
      </SmartCard>

      {/* Pipeline + status + source — required to satisfy the API */}
      <SmartCard icon="cog" title="Pipeline & source" subtitle="Where this ticket lives and how it reached you.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pipeline" required>
            <select className="hs-input"
                    value={form.pipeline_id}
                    onChange={(e) => setForm((f) => ({ ...f, pipeline_id: e.target.value }))}>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Status" required>
            <select className="hs-input"
                    value={form.pipeline_stage_id}
                    onChange={(e) => setForm((f) => ({ ...f, pipeline_stage_id: e.target.value }))}>
              {stageOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}{o.is_paused ? '  •  (SLA paused)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Source" required hint="How did you find out about this issue?">
          <select className="hs-input"
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
            <option value="">Select…</option>
            {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
      </SmartCard>
    </div>
  );
}

/* ====================================================================== */
/*                          STEP 2 — ASSIGNMENT                            */
/* ====================================================================== */

function StepAssignment({
  form, setForm, user,
  engineers, projectManagers, projects, contacts,
  selectedProject, selectedEngineer, selectedManager,
  escalateNow, setEscalateNow,
  canCreateProject, openCreateProject,
}) {
  const canAssign = user?.role === 'admin' || user?.role === 'manager';

  // Auto-assign engineer button — uses workload service to find least-loaded
  // engineer, scoped to the selected project's location if available.
  const [busy, setBusy] = useState(false);
  const autoAssignEngineer = async () => {
    setBusy(true);
    try {
      const r = await workloadService.suggest({ exclude_id: form.assigned_engineer_id || undefined });
      if (!r?.user) return toast('No engineer available right now', { icon: 'ℹ️' });
      setForm((f) => ({ ...f, assigned_engineer_id: String(r.user.id) }));
      toast.success(`Suggested ${r.user.name} (load ${r.user.load_score?.toFixed?.(1) ?? '0'})`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not fetch workload');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Site (= project) selection */}
      <SmartCard icon="globe" title="Site / project" subtitle="Pick the location — engineer & manager auto-fill from here.">
        <Field label="Site" required hint="Maps to a project in your CRM.">
          <select className="hs-input"
                  value={form.project_id}
                  onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}>
            <option value="">Select a site…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.location_name ? ` — ${p.location_name}` : (p.location_code ? ` — ${p.location_code}` : '')}
              </option>
            ))}
          </select>
          {canCreateProject && (
            <button
              type="button"
              onClick={openCreateProject}
              className="mt-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 inline-flex items-center gap-1"
            >
              <Icon name="plus" className="w-3 h-3" /> Create new site / project
            </button>
          )}
        </Field>

        {selectedProject && (
          <HierarchyDiagram
            site={`${selectedProject.name}${selectedProject.location_name ? ` · ${selectedProject.location_name}` : ''}`}
            engineerName={selectedEngineer?.name}
            engineerEmail={selectedEngineer?.email}
            managerName={selectedManager?.name || selectedProject.project_manager_name}
            managerEmail={selectedManager?.email || selectedProject.project_manager_email}
          />
        )}
      </SmartCard>

      {/* Engineer + Manager pickers */}
      <SmartCard icon="users" title="Owner & manager" subtitle="Override the auto-assignment if you need to.">
        <Field label="Ticket owner (engineer)" required>
          <div className="flex items-center gap-2">
            <select
              className="hs-input flex-1"
              value={form.assigned_engineer_id}
              onChange={(e) => setForm((f) => ({ ...f, assigned_engineer_id: e.target.value }))}
            >
              <option value="">Select engineer…</option>
              {engineers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.email ? ` — ${u.email}` : ''}
                </option>
              ))}
            </select>
            {canAssign && (
              <button
                type="button"
                onClick={autoAssignEngineer}
                disabled={busy}
                title="Suggest the least-loaded engineer"
                className="px-2.5 py-2 text-xs font-medium rounded-md border border-gray-300 dark:border-slate-700
                           bg-white dark:bg-slate-800/60 text-gray-700 dark:text-slate-200
                           hover:bg-brand-50 hover:border-brand-300 dark:hover:bg-brand-500/10
                           disabled:opacity-50 inline-flex items-center gap-1"
              >
                {busy ? '…' : <><Icon name="sparkles" className="w-3 h-3" /> Auto</>}
              </button>
            )}
          </div>
        </Field>

        <Field label="Manager" hint="Defaults to the site's project manager if available.">
          <select
            className="hs-input"
            value={form.project_manager_id}
            onChange={(e) => setForm((f) => ({ ...f, project_manager_id: e.target.value }))}
          >
            <option value="">No manager</option>
            {projectManagers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>

        {/* Escalation toggle */}
        <label
          className={`mt-1 block rounded-lg border px-3 py-2.5 cursor-pointer select-none transition
            ${escalateNow
              ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/40'
              : 'border-gray-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-500/30'}`}
        >
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={escalateNow}
              onChange={(e) => setEscalateNow(e.target.checked)}
              className="mt-0.5 accent-rose-600"
            />
            <div className="min-w-0">
              <div className="font-medium text-sm flex items-center gap-1.5">
                <Icon name="bell" className="w-3.5 h-3.5 text-rose-500" />
                Escalate to manager immediately
              </div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400">
                Forces priority to <strong>Urgent</strong> and pings the manager on creation.
              </div>
            </div>
          </div>
        </label>
      </SmartCard>

      {/* Reporter + Contact */}
      <SmartCard icon="userCircle" title="Reporter" subtitle="Who is asking? Helps with follow-ups.">
        <Field label="Contact (optional)" hint="Search an existing contact, or fill the fields below.">
          <select className="hs-input"
                  value={form.contact_id}
                  onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value }))}>
            <option value="">— None —</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.company ? ` — ${c.company}` : ''}
              </option>
            ))}
          </select>
        </Field>
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
      </SmartCard>
    </div>
  );
}

/* ====================================================================== */
/*                            STEP 3 — REVIEW                              */
/* ====================================================================== */

function StepReview({
  form, effectivePriority, slaHours,
  impact, setImpact, autoTags,
  selectedProject, selectedEngineer, selectedManager,
  escalateNow,
}) {
  // Live ticking deadline — anchored at component mount so it doesn't keep
  // shifting forward with every re-render.
  const [anchor]    = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const deadline = anchor + slaHours * 3600 * 1000;
  const remaining = Math.max(0, deadline - now);
  const slaTone =
    remaining < 60 * 60 * 1000      ? 'rose'
    : remaining < 4 * 60 * 60 * 1000 ? 'amber'
    : 'emerald';

  return (
    <div className="space-y-5">
      {/* SLA + Impact */}
      <SmartCard icon="clock" title="SLA & impact" subtitle="The clock starts the moment you click Create.">
        <div
          className={`rounded-xl p-4 mb-4 border-2 ${
            slaTone === 'rose'    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/40' :
            slaTone === 'amber'   ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' :
                                    'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-600 dark:text-slate-400">
                SLA Deadline
              </div>
              <div className="mt-1 font-semibold text-gray-900 dark:text-slate-100">
                {formatDeadline(deadline)}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                Based on <strong>{capitalize(effectivePriority)}</strong> priority
                ({slaHours}h) {escalateNow && <span className="ml-1 text-rose-600 dark:text-rose-400">· escalated</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-600 dark:text-slate-400">
                Time remaining
              </div>
              <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight
                ${slaTone === 'rose' ? 'text-rose-600 dark:text-rose-300' :
                  slaTone === 'amber' ? 'text-amber-600 dark:text-amber-300' :
                  'text-emerald-600 dark:text-emerald-300'}`}>
                {formatCountdown(remaining)}
              </div>
            </div>
          </div>
        </div>

        <Field label="Impact level">
          <div className="grid grid-cols-3 gap-2">
            {IMPACT_OPTIONS.map((o) => {
              const active = impact === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setImpact(o.id)}
                  className={`px-2.5 py-2 rounded-lg border text-left transition
                    ${active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 dark:border-brand-400 ring-1 ring-brand-300/40'
                      : 'border-gray-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50/40 dark:hover:bg-brand-500/5'}
                  `}
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                    <Icon name={o.icon} className="w-3.5 h-3.5" />
                    {o.label}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                    {o.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </Field>
      </SmartCard>

      {/* Summary */}
      <SmartCard icon="checkCircle" title="Confirmation" subtitle="One last look before we open this with the team.">
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800/70">
          <SummaryRow label="Title"    value={form.subject || <span className="text-gray-400">—</span>} />
          <SummaryRow label="Type"     value={
            <span className={`badge ${form.ticket_type === 'incident' ? 'badge-danger' : 'badge-info'}`}>
              {capitalize(form.ticket_type)}
            </span>
          } />
          <SummaryRow label="Priority" value={
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span className={`w-2 h-2 rounded-full ${PRIORITY_OPTIONS.find(p => p.value === effectivePriority)?.dot || 'bg-gray-400'}`} />
              {capitalize(effectivePriority)}
              {escalateNow && <span className="badge-danger ml-1">Escalated</span>}
            </span>
          } />
          <SummaryRow label="Site" value={
            selectedProject
              ? <>{selectedProject.name}{selectedProject.location_name && <span className="text-gray-500 dark:text-slate-500"> · {selectedProject.location_name}</span>}</>
              : <span className="text-gray-400">No site</span>
          } />
          <SummaryRow label="Engineer" value={
            selectedEngineer ? selectedEngineer.name : <span className="text-gray-400">Unassigned</span>
          } />
          <SummaryRow label="Manager" value={
            selectedManager ? selectedManager.name : <span className="text-gray-400">No manager</span>
          } />
          <SummaryRow label="Impact" value={IMPACT_OPTIONS.find(i => i.id === impact)?.label || '—'} />
          <SummaryRow label="SLA" value={`${formatDeadline(Date.now() + slaHours * 3600 * 1000)} (${slaHours}h)`} />
        </div>

        {autoTags.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
              Auto-tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {autoTags.map((t) => (
                <span key={t} className="badge-brand">#{t}</span>
              ))}
            </div>
          </div>
        )}
      </SmartCard>
    </div>
  );
}

/* ====================================================================== */
/*                          QUICK TICKET BUTTON                            */
/* ====================================================================== */

/**
 * Floating "Quick Ticket" capture button.  Opens a tiny modal that takes
 * just a title + site, then submits with smart defaults inferred from
 * keywords + the project's PM.  Shows up on any page that mounts it.
 *
 *   <QuickTicketButton onCreated={reload} />
 */
export function QuickTicketButton({ onCreated, defaultProjectId }) {
  const { user } = useAuth();
  const [open, setOpen]   = useState(false);
  const [title, setTitle] = useState('');
  const [projId, setProjId] = useState(defaultProjectId || '');
  const [projects, setProjects] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [busy, setBusy] = useState(false);

  // Engineers can't create tickets.
  if (user?.role === 'engineer') return null;

  useEffect(() => {
    if (!open) return;
    Promise.all([
      projectsService.list({ active: true }),
      pipelinesService.listPipelines({ active: true }),
    ]).then(([pr, pl]) => {
      setProjects(pr || []);
      setPipelines(pl || []);
      if (!projId && defaultProjectId) setProjId(defaultProjectId);
    }).catch(() => {});
  }, [open, defaultProjectId, projId]);

  const submit = async () => {
    if (title.trim().length < 4) return toast.error('Title needed');
    setBusy(true);
    try {
      const def = pipelines.find(p => p.is_default) || pipelines[0];
      if (!def) throw new Error('No active pipeline');
      const stages = await pipelinesService.listStages(def.id);
      const proj = projects.find(p => String(p.id) === String(projId)) || null;
      const inferred = inferPriority(title);
      const cat = inferCategory(title);
      const description = `Reported via Quick Ticket.${cat ? `\n\nCategory: ${cat}` : ''}`;

      const created = await ticketsService.create({
        subject: title.trim(),
        description,
        priority: inferred.value,
        ticket_type: 'incident',
        pipeline_id: Number(def.id),
        pipeline_stage_id: Number(stages?.[0]?.id),
        source: 'portal',
        assigned_engineer_id: user?.id || null,
        project_manager_id: proj?.project_manager_id || null,
        project_id: proj?.id || null,
      });
      toast.success(`Ticket ${created.ticket_no || `#${created.id}`} created`);
      onCreated?.(created);
      setOpen(false);
      setTitle('');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Quick Ticket (mini capture)"
        className="fixed bottom-6 right-6 z-40 group flex items-center gap-2 pl-3 pr-4 py-3
                   rounded-full text-white font-semibold text-sm
                   bg-gradient-to-r from-[#8b5cf6] to-[#6366f1]
                   shadow-[0_10px_30px_rgba(139,92,246,0.45)]
                   hover:shadow-[0_14px_36px_rgba(139,92,246,0.6)]
                   hover:-translate-y-0.5 transition-all"
      >
        <Icon name="plus" className="w-4 h-4" />
        Quick Ticket
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#13131e]
                          border border-gray-200 dark:border-slate-800 shadow-2xl
                          animate-[fadeIn_.16s_ease-out]">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3">
              <span className="w-7 h-7 rounded-md bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] text-white flex items-center justify-center">
                <Icon name="ticket" className="w-3.5 h-3.5" />
              </span>
              <div>
                <h3 className="font-semibold tracking-tight">Quick Ticket</h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Auto-fills priority, category & SLA — refine later if needed.</p>
              </div>
              <button
                onClick={() => !busy && setOpen(false)}
                className="ml-auto w-8 h-8 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
              >×</button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Title" required>
                <input
                  className="hs-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='e.g. "Network down at Mumbai POP"'
                  autoFocus
                />
              </Field>
              <Field label="Site / project" hint="The project's manager will be notified automatically.">
                <select className="hs-input" value={projId} onChange={(e) => setProjId(e.target.value)}>
                  <option value="">— No site —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.location_name ? ` — ${p.location_name}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {title.trim().length >= 4 && (
                <div className="text-[11px] text-gray-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Icon name="sparkles" className="w-3 h-3 text-brand-500" />
                  <span>Auto-priority: <strong className="text-gray-800 dark:text-slate-200">{capitalize(inferPriority(title).value)}</strong></span>
                  {inferCategory(title) && <span className="ml-2">· Category: <strong>{inferCategory(title)}</strong></span>}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/40 flex items-center gap-2">
              <button onClick={() => setOpen(false)} disabled={busy} className="btn-ghost !px-3">Cancel</button>
              <button onClick={submit} disabled={busy} className="btn-primary ml-auto">
                {busy ? 'Creating…' : 'Create ticket'}
              </button>
            </div>
          </div>
          <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </div>
      )}
    </>
  );
}

/* ====================================================================== */
/*                          SHARED PRIMITIVES                              */
/* ====================================================================== */

function SmartCard({ icon, title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-slate-800/70
                        bg-gradient-to-br from-white to-gray-50/60
                        dark:from-slate-900/40 dark:to-slate-900/10 p-4">
      <header className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/15
                         text-brand-600 dark:text-brand-300
                         flex items-center justify-center">
          <Icon name={icon} className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-slate-100 leading-tight">{title}</h4>
          {subtitle && <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-tight">{subtitle}</p>}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function HierarchyDiagram({ site, engineerName, engineerEmail, managerName, managerEmail }) {
  return (
    <div className="rounded-lg bg-brand-50/50 dark:bg-brand-500/5
                    border border-brand-200/60 dark:border-brand-500/20 p-3 mt-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-brand-700 dark:text-brand-300 mb-2">
        Routing
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <HierarchyNode icon="globe" tone="brand" label="Site" name={site} />
        <Icon name="chevronRight" className="hidden sm:block w-4 h-4 text-brand-400 mx-1 shrink-0" />
        <HierarchyNode icon="userCircle" tone="emerald" label="Engineer"
                       name={engineerName || 'Auto-pick on save'}
                       sub={engineerEmail} />
        <Icon name="chevronRight" className="hidden sm:block w-4 h-4 text-brand-400 mx-1 shrink-0" />
        <HierarchyNode icon="users" tone="amber" label="Manager"
                       name={managerName || '—'}
                       sub={managerEmail} />
      </div>
    </div>
  );
}

function HierarchyNode({ icon, label, name, sub, tone }) {
  const toneCls =
    tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' :
    tone === 'amber'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' :
                         'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300';
  return (
    <div className="flex-1 min-w-0 flex items-start gap-2 px-2.5 py-2 rounded-md bg-white/80 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800">
      <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${toneCls}`}>
        <Icon name={icon} className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-500 leading-tight">
          {label}
        </div>
        <div className="text-[12px] font-semibold text-gray-900 dark:text-slate-100 truncate leading-tight">
          {name}
        </div>
        {sub && (
          <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate leading-tight">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5">
      <div className="w-24 shrink-0 text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400">
        {label}
      </div>
      <div className="flex-1 min-w-0 text-sm text-gray-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

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

function PriorityPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {PRIORITY_OPTIONS.map(p => (
        <button
          type="button"
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-left transition
            ${value === p.value
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 dark:border-brand-400 ring-1 ring-brand-300/40'
              : 'border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/60'}
          `}
        >
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.dot}`} />
          <span className="text-sm">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- helpers ---------- */

function capitalize(s) {
  if (!s) return '';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function slug(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatDeadline(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay)    return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 100) {
    const d = Math.floor(h / 24);
    const hr = h % 24;
    return `${d}d ${String(hr).padStart(2, '0')}h`;
  }
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
