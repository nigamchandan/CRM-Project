// ---------------------------------------------------------------------------
// NEXT-ACTION ENGINE
// ---------------------------------------------------------------------------
// Central, role-aware rule registry. Each rule is a tiny async function that
// returns either `null` (rule doesn't apply / no items) or a Rule object:
//
//   {
//     id:          'leads_to_call'                // stable identifier
//     type:        'lead' | 'deal' | 'task' | 'ticket' | 'assignment',
//     severity:    'info' | 'warning' | 'critical',
//     icon:        'target' | 'briefcase' | ...   // matches Icon.jsx
//     title:       'Leads to call',
//     description: 'Not contacted in 2+ days',
//     count:       number,                        // total items (may exceed `items.length`)
//     link:        '/leads?status=new',           // where the "View all" CTA goes
//     cta:         'Call' | 'Reply' | 'Open' | 'Assign' | 'Complete',
//     items: [
//       { id, label, sublabel, link, hint, badge }
//     ],
//   }
// ---------------------------------------------------------------------------

const { query } = require('../config/db');

const ROLES_TEAM_SCOPE = ['admin', 'manager']; // can see cross-user rules
const PREVIEW_LIMIT = 5;                       // items shown per rule

// SLA targets (mirrors reports.service.js)
const SLA_HOURS_BY_PRIORITY = { high: 4, medium: 24, low: 72 };

// =============================================================================
// PERSONAL RULES (apply to every authenticated user)
// =============================================================================

async function leadsToCall(user) {
  const { rows } = await query(
    `SELECT l.id, l.name, l.company, l.status, l.updated_at
       FROM leads l
      WHERE l.assigned_to = $1
        AND l.status IN ('new','contacted')
        AND l.updated_at < NOW() - INTERVAL '2 days'
      ORDER BY l.updated_at ASC`,
    [user.id]
  );
  if (rows.length === 0) return null;
  return {
    id: 'leads_to_call',
    type: 'lead',
    severity: 'warning',
    icon: 'target',
    title: 'Leads to call',
    description: 'Not contacted in 2+ days',
    count: rows.length,
    link: '/leads',
    cta: 'Call',
    items: rows.slice(0, PREVIEW_LIMIT).map((l) => ({
      id: l.id,
      label: l.name,
      sublabel: `${l.company || 'No company'} · last touched ${daysAgo(l.updated_at)}`,
      link: '/leads',
      badge: l.status,
      hint: 'cold',
    })),
  };
}

async function stuckDeals(user) {
  const { rows } = await query(
    `SELECT d.id, d.title, d.value, d.updated_at,
            s.name AS stage_name, c.name AS contact_name
       FROM deals d
       LEFT JOIN pipeline_stages s ON s.id = d.stage_id
       LEFT JOIN contacts c ON c.id = d.contact_id
      WHERE d.owner_id = $1
        AND d.updated_at < NOW() - INTERVAL '5 days'
        AND (s.name IS NULL OR LOWER(s.name) NOT IN ('won','lost','closed won','closed lost'))
      ORDER BY d.updated_at ASC`,
    [user.id]
  );
  if (rows.length === 0) return null;
  return {
    id: 'stuck_deals',
    type: 'deal',
    severity: 'warning',
    icon: 'briefcase',
    title: 'Deals stuck',
    description: 'No activity in 5+ days',
    count: rows.length,
    link: '/deals',
    cta: 'Open',
    items: rows.slice(0, PREVIEW_LIMIT).map((d) => ({
      id: d.id,
      label: d.title,
      sublabel: `${d.stage_name || 'No stage'}${d.contact_name ? ` · ${d.contact_name}` : ''} · ${daysAgo(d.updated_at)} idle`,
      link: '/deals',
      badge: `$${Number(d.value || 0).toLocaleString()}`,
    })),
  };
}

async function overdueTasks(user) {
  const { rows } = await query(
    `SELECT t.id, t.title, t.priority, t.due_date
       FROM tasks t
      WHERE t.assigned_to = $1
        AND t.status <> 'completed'
        AND t.due_date IS NOT NULL
        AND t.due_date < NOW()
      ORDER BY t.due_date ASC`,
    [user.id]
  );
  if (rows.length === 0) return null;
  return {
    id: 'overdue_tasks',
    type: 'task',
    severity: 'critical',
    icon: 'checkCircle',
    title: 'Overdue tasks',
    description: 'Past due date — knock these out',
    count: rows.length,
    link: '/tasks',
    cta: 'Complete',
    items: rows.slice(0, PREVIEW_LIMIT).map((t) => ({
      id: t.id,
      label: t.title,
      sublabel: `Was due ${daysAgo(t.due_date)} ago`,
      link: '/tasks',
      badge: t.priority,
    })),
  };
}

async function followUpsDueSoon(user) {
  const { rows } = await query(
    `SELECT t.id, t.title, t.priority, t.due_date
       FROM tasks t
      WHERE t.assigned_to = $1
        AND t.status <> 'completed'
        AND t.due_date IS NOT NULL
        AND t.due_date >= NOW()
        AND t.due_date < NOW() + INTERVAL '1 day'
      ORDER BY t.due_date ASC`,
    [user.id]
  );
  if (rows.length === 0) return null;
  return {
    id: 'follow_ups_due',
    type: 'task',
    severity: 'info',
    icon: 'checkCircle',
    title: 'Follow-ups due',
    description: 'Tasks due in the next 24 hours',
    count: rows.length,
    link: '/tasks',
    cta: 'Complete',
    items: rows.slice(0, PREVIEW_LIMIT).map((t) => ({
      id: t.id,
      label: t.title,
      sublabel: `Due ${dueIn(t.due_date)}`,
      link: '/tasks',
      badge: t.priority,
    })),
  };
}

// =============================================================================
// SUPPORT RULES (apply when user has tickets assigned to them)
// =============================================================================

async function slaBreachedTickets(user) {
  const { rows } = await query(
    `SELECT t.id, t.ticket_no, t.subject, t.priority, t.status, t.created_at,
            c.name AS contact_name
       FROM tickets t
       LEFT JOIN contacts c ON c.id = t.contact_id
      WHERE t.assigned_to = $1
        AND t.status IN ('open','in_progress')
        AND (
             (t.priority = 'high'   AND t.created_at < NOW() - INTERVAL '4 hours')
          OR (t.priority = 'medium' AND t.created_at < NOW() - INTERVAL '24 hours')
          OR (t.priority = 'low'    AND t.created_at < NOW() - INTERVAL '72 hours')
        )
      ORDER BY
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.created_at ASC`,
    [user.id]
  );
  if (rows.length === 0) return null;
  return {
    id: 'sla_breached_tickets',
    type: 'ticket',
    severity: 'critical',
    icon: 'bell',
    title: 'SLA breached',
    description: 'Tickets past their response window',
    count: rows.length,
    link: '/tickets',
    cta: 'Reply',
    items: rows.slice(0, PREVIEW_LIMIT).map((t) => {
      const target = SLA_HOURS_BY_PRIORITY[t.priority] || 24;
      const overBy = hoursAgo(t.created_at) - target;
      return {
        id: t.id,
        label: `${t.ticket_no || `#${t.id}`} · ${t.subject}`,
        sublabel: `${t.contact_name || 'No contact'} · ${overBy.toFixed(1)}h over SLA`,
        link: `/tickets/${t.id}`,
        badge: t.priority,
        hint: 'breached',
      };
    }),
  };
}

async function silentTickets(user) {
  // Open/in-progress tickets where the latest activity is the customer (no agent reply yet,
  // or the most recent comment was authored by someone other than the agent and is >2h old)
  const { rows } = await query(
    `WITH latest_comments AS (
       SELECT DISTINCT ON (tc.ticket_id)
              tc.ticket_id, tc.author_id, tc.created_at AS comment_at
         FROM ticket_comments tc
        ORDER BY tc.ticket_id, tc.created_at DESC
     )
     SELECT t.id, t.ticket_no, t.subject, t.priority, t.created_at, t.updated_at,
            c.name AS contact_name,
            lc.comment_at, lc.author_id
       FROM tickets t
       LEFT JOIN contacts c ON c.id = t.contact_id
       LEFT JOIN latest_comments lc ON lc.ticket_id = t.id
      WHERE t.assigned_to = $1
        AND t.status IN ('open','in_progress')
        AND t.updated_at < NOW() - INTERVAL '2 hours'
        AND (lc.author_id IS NULL OR lc.author_id <> $1)
      ORDER BY t.created_at ASC
      LIMIT 50`,
    [user.id]
  );
  if (rows.length === 0) return null;
  return {
    id: 'silent_tickets',
    type: 'ticket',
    severity: 'warning',
    icon: 'ticket',
    title: 'Customers waiting',
    description: 'Tickets with no agent reply in 2+ hours',
    count: rows.length,
    link: '/tickets',
    cta: 'Reply',
    items: rows.slice(0, PREVIEW_LIMIT).map((t) => ({
      id: t.id,
      label: `${t.ticket_no || `#${t.id}`} · ${t.subject}`,
      sublabel: `${t.contact_name || 'No contact'} · waiting ${hoursSince(t.updated_at)}`,
      link: `/tickets/${t.id}`,
      badge: t.priority,
    })),
  };
}

// =============================================================================
// ADMIN / MANAGER RULES (cross-user)
// =============================================================================

async function unassignedLeads() {
  const { rows } = await query(
    `SELECT l.id, l.name, l.company, l.created_at
       FROM leads l
      WHERE l.assigned_to IS NULL
        AND l.status NOT IN ('converted','lost')
      ORDER BY l.created_at ASC
      LIMIT 50`
  );
  if (rows.length === 0) return null;
  return {
    id: 'unassigned_leads',
    type: 'assignment',
    severity: 'warning',
    icon: 'target',
    title: 'Unassigned leads',
    description: 'No owner — assign to a sales rep',
    count: rows.length,
    link: '/leads',
    cta: 'Assign',
    items: rows.slice(0, PREVIEW_LIMIT).map((l) => ({
      id: l.id,
      label: l.name,
      sublabel: `${l.company || 'No company'} · created ${daysAgo(l.created_at)}`,
      link: '/leads',
    })),
  };
}

async function unassignedTickets() {
  const { rows } = await query(
    `SELECT t.id, t.ticket_no, t.subject, t.priority, t.created_at, c.name AS contact_name
       FROM tickets t
       LEFT JOIN contacts c ON c.id = t.contact_id
      WHERE t.assigned_to IS NULL
        AND t.status IN ('open','in_progress')
      ORDER BY
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.created_at ASC
      LIMIT 50`
  );
  if (rows.length === 0) return null;
  return {
    id: 'unassigned_tickets',
    type: 'assignment',
    severity: 'warning',
    icon: 'ticket',
    title: 'Unassigned tickets',
    description: 'Need a support agent',
    count: rows.length,
    link: '/tickets',
    cta: 'Assign',
    items: rows.slice(0, PREVIEW_LIMIT).map((t) => ({
      id: t.id,
      label: `${t.ticket_no || `#${t.id}`} · ${t.subject}`,
      sublabel: `${t.contact_name || 'No contact'} · open ${hoursSince(t.created_at)}`,
      link: `/tickets/${t.id}`,
      badge: t.priority,
    })),
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get the next-action suggestions for a user.
 *  @param {{id:number, role:string}} user
 *  @param {{scope?:'mine'|'team'}} opts
 *    - scope='team' (admins/managers only): also surface cross-user rules.
 */
exports.getForUser = async (user, { scope = 'mine' } = {}) => {
  const seeTeam = scope === 'team' && ROLES_TEAM_SCOPE.includes(user.role);

  // Build the rule list based on scope
  const tasks = [
    overdueTasks(user),
    followUpsDueSoon(user),
    leadsToCall(user),
    stuckDeals(user),
    slaBreachedTickets(user),
    silentTickets(user),
  ];
  if (seeTeam) {
    tasks.push(unassignedLeads(), unassignedTickets());
  }

  const results = await Promise.all(tasks);
  const rules = results.filter(Boolean);

  // Sort: critical first, then warning, then info; tie-break by count desc
  const sevWeight = { critical: 0, warning: 1, info: 2 };
  rules.sort((a, b) => (sevWeight[a.severity] - sevWeight[b.severity]) || (b.count - a.count));

  const total = rules.reduce((s, r) => s + r.count, 0);
  const top_severity = rules[0]?.severity || null;

  return {
    rules,
    total,
    top_severity,
    scope: seeTeam ? 'team' : 'mine',
    counts_by_id: Object.fromEntries(rules.map((r) => [r.id, r.count])),
  };
};

// =============================================================================
// HELPERS
// =============================================================================

function daysAgo(date) {
  const d = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (d === 0) return 'today';
  if (d === 1) return '1 day';
  return `${d} days`;
}
function hoursAgo(date) {
  return (Date.now() - new Date(date).getTime()) / 3600_000;
}
function hoursSince(date) {
  const h = Math.floor(hoursAgo(date));
  if (h < 1)  return 'just now';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day' : `${d} days`;
}
function dueIn(date) {
  const mins = Math.round((new Date(date).getTime() - Date.now()) / 60_000);
  if (mins <= 0)   return 'now';
  if (mins < 60)   return `in ${mins}m`;
  if (mins < 1440) return `in ${Math.round(mins / 60)}h`;
  return `in ${Math.round(mins / 1440)}d`;
}
