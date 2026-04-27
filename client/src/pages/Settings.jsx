import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as settingsService from '../services/settingsService';
import * as dealsService from '../services/dealsService';
import * as ticketPipelinesService from '../services/ticketPipelinesService';
import PageHeader from '../components/ui/PageHeader.jsx';
import Icon from '../components/ui/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// ---------------------------------------------------------------------------
// Settings page — modern sectioned layout (Linear / HubSpot inspired)
// ---------------------------------------------------------------------------
const SECTIONS = [
  { id: 'general',         label: 'General',         icon: 'cog',        sub: 'Workspace identity & locale' },
  { id: 'deal-pipeline',   label: 'Deal Pipeline',   icon: 'trendingUp', sub: 'Sales stages & colors' },
  { id: 'ticket-pipelines',label: 'Ticket Pipelines',icon: 'ticket',     sub: 'Support pipelines & stages' },
  { id: 'sla',             label: 'SLA Policy',      icon: 'slidersV',   sub: 'Response & resolution targets' },
  { id: 'email',           label: 'Email Notifications', icon: 'envelope', sub: 'Outgoing alerts to customers' },
];

export default function Settings() {
  const { user } = useAuth();
  const isAdmin       = user?.role === 'admin';
  const canEditStages = user?.role === 'admin' || user?.role === 'manager';
  const [tab, setTab] = useState(SECTIONS[0].id);

  return (
    <>
      <PageHeader title="Settings" subtitle="Configure your CRM workspace" />

      <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-6">
        {/* ---------------- Sidebar nav ---------------- */}
        <aside className="card p-2 self-start sticky top-4">
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => {
              const active = tab === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setTab(s.id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition
                    ${active
                      ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
                >
                  <span className={`mt-0.5 w-7 h-7 rounded-md flex items-center justify-center
                    ${active
                      ? 'bg-brand-600/15 text-brand-600 dark:text-brand-300'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                    <Icon name={s.icon} className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium leading-5">{s.label}</span>
                    <span className="block text-[11px] text-gray-500 dark:text-slate-400 leading-4 truncate">
                      {s.sub}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ---------------- Active section ---------------- */}
        <main className="space-y-4">
          {tab === 'general'         && <GeneralSection         isAdmin={isAdmin} />}
          {tab === 'deal-pipeline'   && <DealPipelineSection    canEdit={canEditStages} />}
          {tab === 'ticket-pipelines'&& <TicketPipelinesSection canEdit={canEditStages} />}
          {tab === 'sla'             && <SlaSection             isAdmin={isAdmin} />}
          {tab === 'email'           && <EmailSection           isAdmin={isAdmin} />}
        </main>
      </div>
    </>
  );
}

/* =========================================================================
 * Reusable bits
 * =======================================================================*/
function SettingsCard({ title, description, children, footer }) {
  return (
    <div className="card overflow-hidden">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
        <h2 className="section-title text-base">{title}</h2>
        {description && <p className="section-sub">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
      {footer && (
        <footer className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/40 flex items-center justify-end gap-2">
          {footer}
        </footer>
      )}
    </div>
  );
}

function ReadOnlyHint() {
  return (
    <div className="px-5 py-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-100 dark:border-amber-500/20 flex items-center gap-2">
      <Icon name="bell" className="w-4 h-4" />
      Read-only — only an administrator can change these settings.
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, disabled, label, description }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition
          ${checked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-slate-700'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition
            ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-gray-900 dark:text-slate-100">{label}</span>
        {description && (
          <span className="block text-xs text-gray-500 dark:text-slate-400">{description}</span>
        )}
      </span>
    </label>
  );
}

/* =========================================================================
 * General
 * =======================================================================*/
function GeneralSection({ isAdmin }) {
  const [original, setOriginal] = useState({});
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.getAll().then((s) => {
      const slim = {
        'app.name':     s['app.name']     || '',
        'app.currency': s['app.currency'] || '',
        'app.timezone': s['app.timezone'] || '',
        'app.country':  s['app.country']  || '',
      };
      setOriginal(slim); setDraft(slim);
    });
  }, []);

  const dirty = JSON.stringify(original) !== JSON.stringify(draft);

  const save = async () => {
    setSaving(true);
    try {
      await settingsService.upsert(draft);
      setOriginal(draft);
      toast.success('General settings saved');
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  return (
    <SettingsCard
      title="General"
      description="Set your workspace identity, default currency and timezone."
      footer={
        <>
          {dirty && <span className="text-xs text-amber-600 dark:text-amber-400 mr-2">Unsaved changes</span>}
          <button
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={save}
            disabled={!isAdmin || !dirty || saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      {!isAdmin && (
        <div className="-m-5 mb-4">
          <ReadOnlyHint />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="App name" hint="Shown in the topbar and emails.">
          <input className="input" disabled={!isAdmin}
            value={draft['app.name']}
            onChange={(e) => setDraft({ ...draft, 'app.name': e.target.value })} />
        </Field>
        <Field label="Currency" hint="ISO code — e.g. INR, USD, EUR.">
          <input className="input" disabled={!isAdmin} maxLength={3}
            value={draft['app.currency']}
            onChange={(e) => setDraft({ ...draft, 'app.currency': e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Timezone" hint="IANA name — e.g. Asia/Kolkata.">
          <input className="input" disabled={!isAdmin}
            value={draft['app.timezone']}
            onChange={(e) => setDraft({ ...draft, 'app.timezone': e.target.value })} />
        </Field>
        <Field label="Country">
          <input className="input" disabled={!isAdmin}
            value={draft['app.country']}
            onChange={(e) => setDraft({ ...draft, 'app.country': e.target.value })} />
        </Field>
      </div>
    </SettingsCard>
  );
}

/* =========================================================================
 * Deal Pipeline
 * =======================================================================*/
function DealPipelineSection({ canEdit }) {
  const [stages, setStages] = useState([]);
  const [draft, setDraft] = useState({ name: '', color: '#6b7280' });

  const load = () => dealsService.stages.list().then(setStages);
  useEffect(() => { load(); }, []);

  const update = async (s, patch) => {
    try { await dealsService.stages.update(s.id, patch); load(); }
    catch { toast.error('Update failed'); }
  };
  const add = async () => {
    if (!draft.name.trim()) return toast.error('Stage name is required');
    try {
      await dealsService.stages.create({
        ...draft,
        position: (stages[stages.length - 1]?.position || 0) + 1,
      });
      setDraft({ name: '', color: '#6b7280' });
      toast.success('Stage added');
      load();
    } catch { toast.error('Could not add stage'); }
  };
  const remove = async (s) => {
    if (!confirm(`Delete stage "${s.name}"? Deals using this stage will need a new one.`)) return;
    try { await dealsService.stages.remove(s.id); toast.success('Stage removed'); load(); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <SettingsCard
      title="Deal Pipeline Stages"
      description="The lifecycle a deal moves through. Drag the position number to reorder, set a color for the kanban board."
    >
      {!canEdit && (
        <div className="-m-5 mb-4"><ReadOnlyHint /></div>
      )}

      <div className="space-y-2">
        <div className="hidden md:grid md:grid-cols-[40px,1fr,100px,80px] gap-3 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">
          <span>Color</span>
          <span>Stage name</span>
          <span>Position</span>
          <span></span>
        </div>

        {stages.map((s) => (
          <div
            key={s.id}
            className="grid grid-cols-[40px,1fr,100px,80px] gap-3 items-center p-2 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition"
          >
            <div className="relative">
              <input
                type="color"
                value={s.color}
                disabled={!canEdit}
                onChange={(e) => update(s, { color: e.target.value })}
                className="w-9 h-9 rounded-md border border-gray-200 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
            <input
              className="input"
              value={s.name}
              disabled={!canEdit}
              onChange={(e) => update(s, { name: e.target.value })}
            />
            <input
              className="input"
              type="number"
              value={s.position}
              disabled={!canEdit}
              onChange={(e) => update(s, { position: Number(e.target.value) })}
            />
            <div className="flex justify-end">
              {canEdit && (
                <button
                  onClick={() => remove(s)}
                  className="btn-ghost text-red-600 dark:text-red-400 !px-2"
                  title="Delete stage"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {stages.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-slate-400 px-2 py-6 text-center">
            No stages yet — add one below to get started.
          </div>
        )}
      </div>

      {canEdit && (
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800">
          <h3 className="text-sm font-medium text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Icon name="plus" className="w-4 h-4" /> Add new stage
          </h3>
          <div className="grid grid-cols-[40px,1fr,auto] gap-3 items-center">
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="w-9 h-9 rounded-md border border-gray-200 dark:border-slate-700 cursor-pointer"
            />
            <input
              className="input"
              placeholder="e.g. Discovery, Demo, Closed Won"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            />
            <button className="btn-primary" onClick={add}>Add stage</button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

/* =========================================================================
 * Ticket Pipelines
 * =======================================================================*/
const STATUS_CATEGORIES = [
  { value: 'open',        label: 'Open',          color: '#3b82f6' },
  { value: 'in_progress', label: 'In progress',   color: '#0ea5e9' },
  { value: 'waiting',     label: 'Waiting',       color: '#f59e0b' },
  { value: 'resolved',    label: 'Resolved',      color: '#10b981' },
  { value: 'closed',      label: 'Closed',        color: '#6b7280' },
  { value: 'merged',      label: 'Merged',        color: '#8b5cf6' },
];

function TicketPipelinesSection({ canEdit }) {
  const [pipelines, setPipelines] = useState([]);
  const [activeId,  setActiveId]  = useState(null);
  const [stages,    setStages]    = useState([]);
  const [newStage,  setNewStage]  = useState({ name: '', color: '#3b82f6', status_category: 'open' });
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');

  const active = useMemo(() => pipelines.find((p) => p.id === activeId), [pipelines, activeId]);

  const loadPipelines = async () => {
    const list = await ticketPipelinesService.listPipelines();
    setPipelines(list);
    if (!activeId && list.length) setActiveId(list.find((p) => p.is_default)?.id || list[0].id);
  };
  const loadStages = async (pid) => {
    if (!pid) return setStages([]);
    setStages(await ticketPipelinesService.listStages(pid));
  };
  useEffect(() => { loadPipelines(); }, []);
  useEffect(() => { loadStages(activeId); }, [activeId]);

  const updatePipeline = async (id, patch) => {
    try { await ticketPipelinesService.updatePipeline(id, patch); loadPipelines(); }
    catch { toast.error('Update failed'); }
  };
  const updateStage = async (s, patch) => {
    try { await ticketPipelinesService.updateStage(activeId, s.id, patch); loadStages(activeId); }
    catch { toast.error('Update failed'); }
  };
  const removeStage = async (s) => {
    if (!confirm(`Delete stage "${s.name}"?`)) return;
    try { await ticketPipelinesService.removeStage(activeId, s.id); toast.success('Stage removed'); loadStages(activeId); }
    catch { toast.error('Delete failed'); }
  };
  const addStage = async () => {
    if (!newStage.name.trim()) return toast.error('Stage name is required');
    try {
      await ticketPipelinesService.createStage(activeId, {
        ...newStage,
        position: (stages[stages.length - 1]?.position ?? -1) + 1,
      });
      setNewStage({ name: '', color: '#3b82f6', status_category: 'open' });
      toast.success('Stage added');
      loadStages(activeId);
    } catch { toast.error('Could not add stage'); }
  };
  const addPipeline = async () => {
    if (!newPipelineName.trim()) return;
    try {
      const p = await ticketPipelinesService.createPipeline({ name: newPipelineName.trim() });
      setNewPipelineName(''); setShowNewPipeline(false);
      await loadPipelines(); setActiveId(p.id);
      toast.success('Pipeline created');
    } catch { toast.error('Could not create pipeline'); }
  };
  const removePipeline = async (p) => {
    if (!confirm(`Delete the entire "${p.name}" pipeline and all its stages?`)) return;
    try { await ticketPipelinesService.removePipeline(p.id); setActiveId(null); loadPipelines(); toast.success('Pipeline deleted'); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <SettingsCard
      title="Ticket Pipelines"
      description="HubSpot-style stages your support tickets flow through. Each pipeline defines its own stages, colors and SLA-pause behavior."
    >
      {!canEdit && (<div className="-m-5 mb-4"><ReadOnlyHint /></div>)}

      {/* Pipeline picker */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {pipelines.map((p) => {
          const isActive = p.id === activeId;
          return (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-2 transition
                ${isActive
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-brand-400'}`}
            >
              {p.name}
              {p.is_default && (
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded
                  ${isActive ? 'bg-white/20' : 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300'}`}>
                  Default
                </span>
              )}
            </button>
          );
        })}
        {canEdit && !showNewPipeline && (
          <button
            onClick={() => setShowNewPipeline(true)}
            className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1"
          >
            <Icon name="plus" className="w-3.5 h-3.5" /> New pipeline
          </button>
        )}
        {showNewPipeline && (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input w-48"
              placeholder="Pipeline name"
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addPipeline(); if (e.key === 'Escape') { setShowNewPipeline(false); setNewPipelineName(''); } }}
            />
            <button className="btn-primary !py-1.5" onClick={addPipeline}>Add</button>
            <button className="btn-ghost !py-1.5" onClick={() => { setShowNewPipeline(false); setNewPipelineName(''); }}>Cancel</button>
          </div>
        )}
      </div>

      {active && (
        <>
          {/* Active pipeline meta */}
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 p-3 mb-4 flex flex-wrap items-center gap-3">
            <input
              className="input flex-1 min-w-[200px] !bg-white dark:!bg-slate-900"
              value={active.name}
              disabled={!canEdit}
              onChange={(e) => updatePipeline(active.id, { name: e.target.value })}
            />
            <Toggle
              checked={!!active.is_default}
              disabled={!canEdit || active.is_default}
              onChange={(v) => v && updatePipeline(active.id, { is_default: true })}
              label="Default pipeline"
              description="New tickets land here automatically."
            />
            {canEdit && (
              <button
                onClick={() => removePipeline(active)}
                className="btn-ghost text-red-600 dark:text-red-400 !px-3"
                title="Delete pipeline"
              >
                <Icon name="trash" className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stages list */}
          <div className="space-y-2">
            <div className="hidden md:grid md:grid-cols-[28px,40px,1.2fr,1fr,100px,160px,40px] gap-3 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">
              <span></span>
              <span>Color</span>
              <span>Stage name</span>
              <span>Maps to status</span>
              <span>Position</span>
              <span>Behavior</span>
              <span></span>
            </div>

            {stages.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[28px,40px,1.2fr,1fr,100px,160px,40px] gap-3 items-center p-2 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-gray-50/60 dark:hover:bg-slate-800/40"
              >
                <span className="text-gray-300 dark:text-slate-600 flex justify-center">
                  <Icon name="gripVertical" className="w-4 h-4" />
                </span>
                <input
                  type="color"
                  value={s.color}
                  disabled={!canEdit}
                  onChange={(e) => updateStage(s, { color: e.target.value })}
                  className="w-9 h-9 rounded-md border border-gray-200 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                />
                <input
                  className="input"
                  value={s.name}
                  disabled={!canEdit}
                  onChange={(e) => updateStage(s, { name: e.target.value })}
                />
                <select
                  className="input"
                  value={s.status_category}
                  disabled={!canEdit}
                  onChange={(e) => updateStage(s, { status_category: e.target.value })}
                >
                  {STATUS_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  value={s.position}
                  disabled={!canEdit}
                  onChange={(e) => updateStage(s, { position: Number(e.target.value) })}
                />
                <div className="flex flex-col gap-1 text-[11px]">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      checked={!!s.is_closed_state}
                      disabled={!canEdit}
                      onChange={(e) => updateStage(s, { is_closed_state: e.target.checked })}
                    />
                    <span className="text-gray-700 dark:text-slate-300">Closed state</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      checked={!!s.is_sla_paused}
                      disabled={!canEdit}
                      onChange={(e) => updateStage(s, { is_sla_paused: e.target.checked })}
                    />
                    <span className="text-gray-700 dark:text-slate-300">Pauses SLA</span>
                  </label>
                </div>
                <div className="flex justify-end">
                  {canEdit && (
                    <button
                      onClick={() => removeStage(s)}
                      className="btn-ghost text-red-600 dark:text-red-400 !px-2"
                      title="Delete stage"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {stages.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-slate-400 px-2 py-6 text-center">
                No stages yet — add the first one below.
              </div>
            )}
          </div>

          {canEdit && (
            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800">
              <h3 className="text-sm font-medium text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Icon name="plus" className="w-4 h-4" /> Add stage
              </h3>
              <div className="grid grid-cols-[40px,1fr,1fr,auto] gap-3 items-center">
                <input
                  type="color"
                  value={newStage.color}
                  onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
                  className="w-9 h-9 rounded-md border border-gray-200 dark:border-slate-700 cursor-pointer"
                />
                <input
                  className="input"
                  placeholder="e.g. Awaiting parts"
                  value={newStage.name}
                  onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') addStage(); }}
                />
                <select
                  className="input"
                  value={newStage.status_category}
                  onChange={(e) => setNewStage({ ...newStage, status_category: e.target.value })}
                >
                  {STATUS_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <button className="btn-primary" onClick={addStage}>Add</button>
              </div>
            </div>
          )}
        </>
      )}
    </SettingsCard>
  );
}

/* =========================================================================
 * SLA Policy
 * =======================================================================*/
const PRIORITY_ROWS = [
  { key: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',     description: 'Outage / business stopped' },
  { key: 'high',     label: 'High',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', description: 'Major impact, workaround exists' },
  { key: 'medium',   label: 'Medium',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',   description: 'Standard operational issue' },
  { key: 'low',      label: 'Low',      color: 'bg-gray-100 text-gray-700 dark:bg-slate-700/50 dark:text-slate-300',     description: 'Question or minor request' },
];

function SlaSection({ isAdmin }) {
  const [original, setOriginal] = useState(null);
  const [draft,    setDraft]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    settingsService.getSla().then((p) => { setOriginal(p); setDraft(p); });
  }, []);

  const dirty = !!draft && JSON.stringify(original) !== JSON.stringify(draft);

  const updateRow = (key, patch) =>
    setDraft({ ...draft, [key]: { ...(draft[key] || {}), ...patch } });

  const save = async () => {
    setSaving(true);
    try {
      const next = await settingsService.setSla(draft);
      setOriginal(next); setDraft(next);
      toast.success('SLA policy saved');
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  if (!draft) {
    return <SettingsCard title="SLA Policy"><p className="text-sm text-gray-500">Loading…</p></SettingsCard>;
  }

  return (
    <SettingsCard
      title="SLA Policy"
      description="Set response & resolution targets per priority. Used to compute due dates and surface breaches in Next Actions."
      footer={
        <>
          {dirty && <span className="text-xs text-amber-600 dark:text-amber-400 mr-2">Unsaved changes</span>}
          <button
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={save}
            disabled={!isAdmin || !dirty || saving}
          >
            {saving ? 'Saving…' : 'Save policy'}
          </button>
        </>
      }
    >
      {!isAdmin && (<div className="-m-5 mb-4"><ReadOnlyHint /></div>)}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-slate-400">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Priority</th>
              <th className="text-left px-3 py-2 font-medium">First response (minutes)</th>
              <th className="text-left px-3 py-2 font-medium">Resolution (hours)</th>
              <th className="text-left px-3 py-2 font-medium">Business hours only</th>
            </tr>
          </thead>
          <tbody>
            {PRIORITY_ROWS.map((row) => {
              const v = draft[row.key] || { response_minutes: 0, resolution_hours: 0, business_hours: false };
              return (
                <tr key={row.key} className="border-t border-gray-100 dark:border-slate-800">
                  <td className="px-3 py-3">
                    <span className={`badge ${row.color} font-semibold capitalize`}>{row.label}</span>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">{row.description}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={1} disabled={!isAdmin}
                        className="input w-28"
                        value={v.response_minutes}
                        onChange={(e) => updateRow(row.key, { response_minutes: Number(e.target.value) })}
                      />
                      <span className="text-xs text-gray-500 dark:text-slate-400">min</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={1} disabled={!isAdmin}
                        className="input w-28"
                        value={v.resolution_hours}
                        onChange={(e) => updateRow(row.key, { resolution_hours: Number(e.target.value) })}
                      />
                      <span className="text-xs text-gray-500 dark:text-slate-400">hrs</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Toggle
                      checked={!!v.business_hours}
                      disabled={!isAdmin}
                      onChange={(val) => updateRow(row.key, { business_hours: val })}
                      label={v.business_hours ? 'Yes' : 'No'}
                      description="Only count working-hour minutes."
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SettingsCard>
  );
}

/* =========================================================================
 * Email Notifications
 * =======================================================================*/
function EmailSection({ isAdmin }) {
  const [original, setOriginal] = useState(null);
  const [draft,    setDraft]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    settingsService.getEmail().then((e) => { setOriginal(e); setDraft(e); });
  }, []);

  const dirty = !!draft && JSON.stringify(original) !== JSON.stringify(draft);

  const save = async () => {
    setSaving(true);
    try {
      const next = await settingsService.setEmail(draft);
      setOriginal(next); setDraft(next);
      toast.success('Email settings saved');
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  if (!draft) {
    return <SettingsCard title="Email Notifications"><p className="text-sm text-gray-500">Loading…</p></SettingsCard>;
  }

  return (
    <SettingsCard
      title="Email Notifications"
      description="Outgoing email triggers and the From identity used by the support inbox."
      footer={
        <>
          {dirty && <span className="text-xs text-amber-600 dark:text-amber-400 mr-2">Unsaved changes</span>}
          <button
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={save}
            disabled={!isAdmin || !dirty || saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      {!isAdmin && (<div className="-m-5 mb-4"><ReadOnlyHint /></div>)}

      <div className="space-y-4">
        <div className="rounded-lg border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
          <div className="p-4">
            <Toggle
              checked={!!draft.ticket_created}
              disabled={!isAdmin}
              onChange={(v) => setDraft({ ...draft, ticket_created: v })}
              label="Notify on ticket creation"
              description="Send a confirmation email to the reporter when a new ticket is opened."
            />
          </div>
          <div className="p-4">
            <Toggle
              checked={!!draft.ticket_closed}
              disabled={!isAdmin}
              onChange={(v) => setDraft({ ...draft, ticket_closed: v })}
              label="Notify on ticket closure"
              description="Send a wrap-up email summarising the resolution when a ticket is closed."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="From name" hint="Shown as the sender in the recipient's inbox.">
            <input
              className="input" disabled={!isAdmin}
              value={draft.from_name || ''}
              onChange={(e) => setDraft({ ...draft, from_name: e.target.value })}
            />
          </Field>
          <Field label="From email" hint="Reply-to address customers will see.">
            <input
              type="email" className="input" disabled={!isAdmin}
              value={draft.from_email || ''}
              onChange={(e) => setDraft({ ...draft, from_email: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </SettingsCard>
  );
}
