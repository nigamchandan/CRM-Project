require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');

/**
 * India-themed demo seed for the Enterprise Ticket System.
 *
 * Story (matches the user's example):
 *   - Nigam Behera works in Chennai (Chennai Support team).
 *   - Customers from various Chennai projects (SRS, Asteroid, Galaxy, Mahawali,
 *     NTT, Orange) call/email Nigam to report issues.
 *   - When Nigam (or a customer) opens a ticket, the system asks for:
 *       Project, Source (call / email / portal), Engineer, Reporter contact.
 *   - Each project has its own Project Manager who is notified automatically.
 *   - SLA targets per priority are configurable via Settings (default policy
 *     is seeded below).
 */
async function main() {
  const fresh = process.argv.includes('--fresh') || process.env.SEED_FRESH === '1';

  console.log(`[seed] starting (India edition)${fresh ? ' — FRESH (wiping demo tables)' : ''}…`);

  if (fresh) {
    // Wipe all per-record demo data + projects / teams / non-India locations & users so we land
    // on a clean India-only dataset. Roles + the three legacy demo handles
    // (admin/manager/sales @crm.test) are preserved so the login page demo cards keep working.
    await query(`TRUNCATE TABLE
                   ticket_comments, tickets,
                   tasks, deals, leads, contacts,
                   notifications, logs
                 RESTART IDENTITY CASCADE`);
    await query(`DELETE FROM projects`);
    await query(`DELETE FROM teams`);
    // Detach users from old locations/teams before deleting them.
    await query(`UPDATE users SET location_id = NULL, team_id = NULL, manager_id = NULL`);
    await query(`DELETE FROM locations`);
    await query(`DELETE FROM users WHERE email LIKE '%@crm.test'
                   AND email NOT IN ('admin@crm.test','manager@crm.test','sales@crm.test')`);
  }


  /* -------------------------------------------------------------- ROLES */
  const roles = [
    { name: 'admin',    description: 'Full access' },
    { name: 'manager',  description: 'Team / project lead — manages engineers & escalations' },
    { name: 'engineer', description: 'Support engineer — handles assigned tickets' },
    { name: 'user',     description: 'Regular user (sales / general)' },
  ];
  for (const r of roles) {
    await query(
      `INSERT INTO roles (name, description) VALUES ($1,$2)
       ON CONFLICT (name) DO NOTHING`, [r.name, r.description]);
  }

  /* ------------------------------------------------------------ LOCATIONS */
  const locations = [
    { name: 'Chennai',   code: 'CHE', address: 'Tidel Park, Taramani, Chennai',          timezone: 'Asia/Kolkata' },
    { name: 'Bengaluru', code: 'BLR', address: 'Whitefield, Bengaluru',                  timezone: 'Asia/Kolkata' },
    { name: 'Hyderabad', code: 'HYD', address: 'HITEC City, Hyderabad',                  timezone: 'Asia/Kolkata' },
    { name: 'Mumbai',    code: 'BOM', address: 'Bandra Kurla Complex, Mumbai',           timezone: 'Asia/Kolkata' },
    { name: 'Delhi NCR', code: 'DEL', address: 'Cyber City, Gurugram',                   timezone: 'Asia/Kolkata' },
  ];
  for (const l of locations) {
    await query(
      `INSERT INTO locations (name,code,address,timezone)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (name) DO NOTHING`,
      [l.name, l.code, l.address, l.timezone]);
  }
  const locByName = Object.fromEntries(
    (await query(`SELECT id,name FROM locations`)).rows.map((l) => [l.name, l.id])
  );

  /* ---------------------------------------------------------------- TEAMS */
  const teams = [
    { name: 'Chennai Support',       location: 'Chennai',   description: 'L1/L2 customer support — Chennai office' },
    { name: 'Chennai Engineering',   location: 'Chennai',   description: 'Project engineering — Chennai office' },
    { name: 'Bengaluru Engineering', location: 'Bengaluru', description: 'Core platform engineering — Bengaluru' },
    { name: 'Hyderabad Support',     location: 'Hyderabad', description: 'Customer success & support — Hyderabad' },
    { name: 'Mumbai Sales',          location: 'Mumbai',    description: 'Enterprise sales — Mumbai' },
  ];
  for (const t of teams) {
    await query(
      `INSERT INTO teams (name, location_id, description)
       VALUES ($1,$2,$3)
       ON CONFLICT (name, location_id) DO NOTHING`,
      [t.name, locByName[t.location], t.description]);
  }
  const teamByName = Object.fromEntries(
    (await query(`SELECT id,name,location_id FROM teams`)).rows.map((t) => [t.name, t])
  );

  /* ---------------------------------------------------------------- USERS */
  // Backwards-compat emails (admin/manager/sales) preserved so the login page demo cards still work.
  const users = [
    { name: 'Arjun Kumar (Admin)', email: 'admin@crm.test',     password: 'admin123',   role: 'admin',    location: 'Chennai' },

    // Chennai Support — Vikram is the reporting manager for Chennai support engineers
    { name: 'Vikram Iyer',         email: 'manager@crm.test',   password: 'manager123', role: 'manager',  team: 'Chennai Support' },

    // Chennai Support engineers (Nigam Behera = the user)
    { name: 'Nigam Behera',        email: 'nigam@crm.test',     password: 'nigam123',   role: 'engineer', team: 'Chennai Support', managerEmail: 'manager@crm.test' },
    { name: 'Aarav Pillai',        email: 'aarav@crm.test',     password: 'aarav123',   role: 'engineer', team: 'Chennai Support', managerEmail: 'manager@crm.test' },
    { name: 'Karthik Raman',       email: 'karthik@crm.test',   password: 'karthik123', role: 'engineer', team: 'Chennai Support', managerEmail: 'manager@crm.test' },

    // Bengaluru Engineering
    { name: 'Anitha Krishnan',     email: 'anitha@crm.test',    password: 'anitha123',  role: 'manager',  team: 'Bengaluru Engineering' },
    { name: 'Rohan Mehta',         email: 'rohan@crm.test',     password: 'rohan123',   role: 'engineer', team: 'Bengaluru Engineering', managerEmail: 'anitha@crm.test' },
    { name: 'Priya Reddy',         email: 'priya@crm.test',     password: 'priya123',   role: 'engineer', team: 'Bengaluru Engineering', managerEmail: 'anitha@crm.test' },

    // Hyderabad Support
    { name: 'Suresh Nair',         email: 'suresh@crm.test',    password: 'suresh123',  role: 'manager',  team: 'Hyderabad Support' },
    { name: 'Divya Menon',         email: 'divya@crm.test',     password: 'divya123',   role: 'engineer', team: 'Hyderabad Support', managerEmail: 'suresh@crm.test' },

    // Sales (kept on the original sales@crm.test email)
    { name: 'Riya Sharma',         email: 'sales@crm.test',     password: 'sales123',   role: 'user',     team: 'Mumbai Sales' },

    // Project Managers (one per Chennai project)
    { name: 'Rajesh Subramanian',  email: 'rajesh.pm@crm.test', password: 'rajesh123',  role: 'manager',  team: 'Chennai Engineering' },
    { name: 'Lakshmi Venkatesh',   email: 'lakshmi.pm@crm.test',password: 'lakshmi123', role: 'manager',  team: 'Chennai Engineering' },
    { name: 'Mohan Krishnan',      email: 'mohan.pm@crm.test',  password: 'mohan123',   role: 'manager',  team: 'Chennai Engineering' },
    { name: 'Bhavna Rao',          email: 'bhavna.pm@crm.test', password: 'bhavna123',  role: 'manager',  team: 'Chennai Engineering' },
    { name: 'Sandeep Joshi',       email: 'sandeep.pm@crm.test',password: 'sandeep123', role: 'manager',  team: 'Chennai Engineering' },
    { name: 'Kavya Nair',          email: 'kavya.pm@crm.test',  password: 'kavya123',   role: 'manager',  team: 'Chennai Engineering' },
  ];

  // pass 1 — insert/upsert users
  for (const u of users) {
    const hash  = await bcrypt.hash(u.password, 10);
    const team  = u.team ? teamByName[u.team] : null;
    const locId = team?.location_id || (u.location ? locByName[u.location] : null);
    await query(
      `INSERT INTO users (name,email,password,role,is_active,location_id,team_id)
       VALUES ($1,$2,$3,$4,TRUE,$5,$6)
       ON CONFLICT (email) DO UPDATE SET
         name        = EXCLUDED.name,
         role        = EXCLUDED.role,
         location_id = COALESCE(EXCLUDED.location_id, users.location_id),
         team_id     = COALESCE(EXCLUDED.team_id,     users.team_id)`,
      [u.name, u.email, hash, u.role, locId, team?.id || null]);
  }
  // pass 2 — wire reporting manager_id
  for (const u of users) {
    if (!u.managerEmail) continue;
    await query(
      `UPDATE users
          SET manager_id = (SELECT id FROM users WHERE email = $2)
        WHERE email = $1`,
      [u.email, u.managerEmail]);
  }

  /* ------------------------------------------------------------- PROJECTS */
  // All projects belong to Chennai per the user's example workflow.
  const projects = [
    { name: 'SRS',      code: 'SRS',  pm: 'rajesh.pm@crm.test',  customer: 'SRS Technologies',         email: 'support@srs-tech.in',       phone: '+91-44-2300-1101', location: 'Chennai', description: 'Manufacturing ERP rollout for SRS Technologies' },
    { name: 'Asteroid', code: 'ASTR', pm: 'lakshmi.pm@crm.test', customer: 'Asteroid Systems',         email: 'helpdesk@asteroid.in',      phone: '+91-44-2300-1102', location: 'Chennai', description: 'Realtime telemetry platform for Asteroid Systems' },
    { name: 'Galaxy',   code: 'GAL',  pm: 'mohan.pm@crm.test',   customer: 'Galaxy Solutions',         email: 'it@galaxy-solutions.in',    phone: '+91-44-2300-1103', location: 'Chennai', description: 'Customer portal & billing for Galaxy Solutions' },
    { name: 'Mahawali', code: 'MHWL', pm: 'bhavna.pm@crm.test',  customer: 'Mahawali Industries',      email: 'admin@mahawali.in',         phone: '+91-44-2300-1104', location: 'Chennai', description: 'Plant maintenance & IoT for Mahawali Industries' },
    { name: 'NTT',      code: 'NTT',  pm: 'sandeep.pm@crm.test', customer: 'NTT Data India',           email: 'svc-desk@ntt-india.in',     phone: '+91-44-2300-1105', location: 'Chennai', description: 'Data-center monitoring for NTT Data India' },
    { name: 'Orange',   code: 'ORNG', pm: 'kavya.pm@crm.test',   customer: 'Orange Business Services', email: 'helpdesk@orange-india.in',  phone: '+91-44-2300-1106', location: 'Chennai', description: 'Network operations support for Orange Business Services' },
  ];
  for (const p of projects) {
    await query(
      `INSERT INTO projects
          (name,code,location_id,project_manager_id,customer,customer_email,customer_phone,description,is_active)
       VALUES ($1,$2,$3,(SELECT id FROM users WHERE email=$4),$5,$6,$7,$8,TRUE)
       ON CONFLICT (name,location_id) DO UPDATE SET
         code               = EXCLUDED.code,
         project_manager_id = EXCLUDED.project_manager_id,
         customer           = EXCLUDED.customer,
         customer_email     = EXCLUDED.customer_email,
         customer_phone     = EXCLUDED.customer_phone,
         description        = EXCLUDED.description`,
      [p.name, p.code, locByName[p.location], p.pm, p.customer, p.email, p.phone, p.description]);
  }

  /* -------------------------------------------- TICKET PIPELINES + STAGES */
  // Mirrors the HubSpot "Support Pipeline" + 7 stages from the reference doc.
  const pipelines = [
    {
      name: 'Support Pipeline',
      description: 'Default support flow — covers new tickets through resolution',
      is_default: true, sort_order: 0,
      stages: [
        { name: 'New',                  position: 1, status_category: 'open',        color: '#3b82f6', is_closed_state: false, is_sla_paused: false },
        { name: 'In Progress',          position: 2, status_category: 'in_progress', color: '#8b5cf6', is_closed_state: false, is_sla_paused: false },
        { name: 'Waiting for Customer', position: 3, status_category: 'waiting',     color: '#f59e0b', is_closed_state: false, is_sla_paused: true  },
        { name: 'With Hardware Team',   position: 4, status_category: 'in_progress', color: '#14b8a6', is_closed_state: false, is_sla_paused: false },
        { name: 'Closed',               position: 5, status_category: 'closed',      color: '#10b981', is_closed_state: true,  is_sla_paused: true  },
        { name: 'Reopen',               position: 6, status_category: 'open',        color: '#ef4444', is_closed_state: false, is_sla_paused: false },
        { name: 'Merged',               position: 7, status_category: 'merged',      color: '#6b7280', is_closed_state: true,  is_sla_paused: true  },
      ],
    },
    {
      name: 'Hardware Pipeline',
      description: 'Hardware replacement / on-site engineering tickets',
      is_default: false, sort_order: 1,
      stages: [
        { name: 'New',                  position: 1, status_category: 'open',        color: '#3b82f6', is_closed_state: false, is_sla_paused: false },
        { name: 'Diagnosing',           position: 2, status_category: 'in_progress', color: '#8b5cf6', is_closed_state: false, is_sla_paused: false },
        { name: 'Awaiting Spare Part',  position: 3, status_category: 'waiting',     color: '#f59e0b', is_closed_state: false, is_sla_paused: true  },
        { name: 'On-site',              position: 4, status_category: 'in_progress', color: '#14b8a6', is_closed_state: false, is_sla_paused: false },
        { name: 'Closed',               position: 5, status_category: 'closed',      color: '#10b981', is_closed_state: true,  is_sla_paused: true  },
      ],
    },
  ];
  for (const pl of pipelines) {
    await query(
      `INSERT INTO ticket_pipelines (name,description,is_default,sort_order)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (name) DO UPDATE SET
         description = EXCLUDED.description,
         is_default  = EXCLUDED.is_default,
         sort_order  = EXCLUDED.sort_order`,
      [pl.name, pl.description, pl.is_default, pl.sort_order]
    );
    const { rows: pr } = await query(`SELECT id FROM ticket_pipelines WHERE name=$1`, [pl.name]);
    const pid = pr[0].id;
    for (const st of pl.stages) {
      await query(
        `INSERT INTO ticket_pipeline_stages
            (pipeline_id, name, position, status_category, color, is_closed_state, is_sla_paused)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (pipeline_id, name) DO UPDATE SET
           position        = EXCLUDED.position,
           status_category = EXCLUDED.status_category,
           color           = EXCLUDED.color,
           is_closed_state = EXCLUDED.is_closed_state,
           is_sla_paused   = EXCLUDED.is_sla_paused,
           updated_at      = NOW()`,
        [pid, st.name, st.position, st.status_category, st.color, st.is_closed_state, st.is_sla_paused]
      );
    }
  }

  /* ------------------------------------------------------ PIPELINE STAGES */
  const stages = [
    { name: 'Lead In',     position: 1, color: '#3b82f6' },
    { name: 'Contacted',   position: 2, color: '#8b5cf6' },
    { name: 'Qualified',   position: 3, color: '#f59e0b' },
    { name: 'Proposal',    position: 4, color: '#ec4899' },
    { name: 'Negotiation', position: 5, color: '#14b8a6' },
    { name: 'Won',         position: 6, color: '#10b981' },
    { name: 'Lost',        position: 7, color: '#ef4444' },
  ];
  for (const s of stages) {
    const existing = await query('SELECT id FROM pipeline_stages WHERE name=$1', [s.name]);
    if (!existing.rows.length) {
      await query(`INSERT INTO pipeline_stages (name,position,color) VALUES ($1,$2,$3)`,
        [s.name, s.position, s.color]);
    }
  }

  /* ------------------------------------------------------------ CONTACTS */
  if ((await query('SELECT COUNT(*)::int AS c FROM contacts')).rows[0].c === 0) {
    const adminId = (await query(`SELECT id FROM users WHERE email='admin@crm.test'`)).rows[0]?.id;
    const demos = [
      ['Aditya Verma',  'aditya.verma@tcs.com',     '+91-98400-10001', 'Tata Consultancy Services', 'Olympia Tech Park, Chennai',   ['enterprise','vip']],
      ['Sneha Iyer',    'sneha.iyer@infosys.com',   '+91-98400-10002', 'Infosys',                   'Electronic City, Bengaluru',   ['enterprise']],
      ['Rahul Khanna',  'rahul.khanna@wipro.com',   '+91-98400-10003', 'Wipro',                     'Sarjapur Road, Bengaluru',     ['enterprise']],
      ['Meera Pillai',  'meera.pillai@hcl.com',     '+91-98400-10004', 'HCL Technologies',          'Madhapur, Hyderabad',          ['smb']],
      ['Vivek Patel',   'vivek.patel@reliance.com', '+91-98400-10005', 'Reliance Industries',       'Bandra Kurla Complex, Mumbai', ['vip']],
      ['Ananya Bose',   'ananya.bose@flipkart.com', '+91-98400-10006', 'Flipkart',                  'Bellandur, Bengaluru',         ['new']],
    ];
    for (const [n,e,p,c,a,t] of demos) {
      await query(
        `INSERT INTO contacts (name,email,phone,company,address,tags,owner_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [n,e,p,c,a,t,adminId]);
    }
  }

  /* --------------------------------------------------------------- LEADS */
  if ((await query('SELECT COUNT(*)::int AS c FROM leads')).rows[0].c === 0) {
    const salesId = (await query(`SELECT id FROM users WHERE email='sales@crm.test'`)).rows[0]?.id;
    const demos = [
      ['Naveen Kumar',   'naveen@zoho.com',       '+91-99400-30001', 'Zoho Corp',    'Website',  'new',       250000,  salesId],
      ['Pooja Saxena',   'pooja@freshworks.com',  '+91-99400-30002', 'Freshworks',   'Referral', 'contacted', 600000,  salesId],
      ['Sanjay Gupta',   'sanjay@swiggy.com',     '+91-99400-30003', 'Swiggy',       'LinkedIn', 'qualified', 1500000, salesId],
      ['Neha Choudhary', 'neha@paytm.com',        '+91-99400-30004', 'Paytm',        'Event',    'converted', 2200000, salesId],
      ['Arvind Bhatt',   'arvind@ola.com',        '+91-99400-30005', 'Ola',          'Cold Call','new',       400000,  salesId],
    ];
    for (const [n,e,p,c,src,st,v,a] of demos) {
      await query(
        `INSERT INTO leads (name,email,phone,company,source,status,value,assigned_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [n,e,p,c,src,st,v,a]);
    }
  }

  /* --------------------------------------------------------------- DEALS */
  if ((await query('SELECT COUNT(*)::int AS c FROM deals')).rows[0].c === 0) {
    const stageMap = {};
    (await query('SELECT id, name FROM pipeline_stages')).rows.forEach(s => (stageMap[s.name] = s.id));
    const ownerId  = (await query(`SELECT id FROM users WHERE email='sales@crm.test'`)).rows[0]?.id;
    const contacts = (await query('SELECT id, name FROM contacts ORDER BY id LIMIT 6')).rows;
    const demos = [
      { title: 'TCS — Service Desk Modernisation',    value: 4500000, stage: 'Qualified',   contact: 0 },
      { title: 'Infosys — Cloud Migration Phase 2',   value: 7800000, stage: 'Proposal',    contact: 1 },
      { title: 'Wipro — 24x7 NOC Contract',           value: 3200000, stage: 'Contacted',   contact: 2 },
      { title: 'HCL — Customer Success Platform',     value: 2400000, stage: 'Negotiation', contact: 3 },
      { title: 'Reliance — IoT Plant Monitoring',     value: 9500000, stage: 'Lead In',     contact: 4 },
      { title: 'Flipkart — Realtime Analytics POC',   value: 1800000, stage: 'Won',         contact: 5 },
    ];
    for (const d of demos) {
      await query(
        `INSERT INTO deals (title,value,currency,stage_id,contact_id,owner_id,expected_close_date,position)
         VALUES ($1,$2,'INR',$3,$4,$5, NOW() + INTERVAL '30 days', 0)`,
        [d.title, d.value, stageMap[d.stage], contacts[d.contact]?.id, ownerId]);
    }
  }

  /* ------------------------------------------------------------- TICKETS */
  if ((await query('SELECT COUNT(*)::int AS c FROM tickets')).rows[0].c === 0) {
    const adminId = (await query(`SELECT id FROM users WHERE email='admin@crm.test'`)).rows[0]?.id;
    const userByEmail = {};
    (await query(
      `SELECT id,email,manager_id,location_id,team_id FROM users
        WHERE email = ANY($1::varchar[])`,
      [['nigam@crm.test','aarav@crm.test','karthik@crm.test','rohan@crm.test','priya@crm.test','divya@crm.test']]
    )).rows.forEach((u) => { userByEmail[u.email] = u; });
    const projByName = {};
    (await query(`SELECT id,name,project_manager_id,location_id FROM projects`)).rows.forEach(p => (projByName[p.name] = p));

    // Default pipeline + stage lookup
    const { rows: defPipe } = await query(`SELECT id FROM ticket_pipelines WHERE is_default = TRUE LIMIT 1`);
    const defaultPipelineId = defPipe[0]?.id;
    const stagesByName = {};
    (await query(
      `SELECT id, name FROM ticket_pipeline_stages WHERE pipeline_id = $1`,
      [defaultPipelineId]
    )).rows.forEach((s) => { stagesByName[s.name] = s.id; });

    // [subject, description, stage, priority, engineerEmail, source, project, reporterName, reporterEmail, reporterPhone]
    // Subjects taken from the user's HubSpot screenshots so the demo data feels familiar.
    const demos = [
      ['At the Asteroid Chennai location, some mouse and keyboards are not working.',
       'Replacement requested for several mouse + keyboard sets at the Asteroid Chennai office.',
       'New', 'medium',  'nigam@crm.test',   'phone', 'Asteroid', 'Sneha Iyer',     'sneha.iyer@asteroid.in',           '+91-98400-50002'],
      ['In the Asteroid project, the printer is not working properly.',
       'Network printer at Asteroid Chennai prints blank pages intermittently.',
       'In Progress', 'medium', 'aarav@crm.test', 'email', 'Asteroid', 'Sneha Iyer', 'sneha.iyer@asteroid.in',           '+91-98400-50002'],
      ['The customer wants to format one SRS workstation.',
       'Customer raised request to wipe & re-image WS-04 at SRS site.',
       'Waiting for Customer', 'low', 'nigam@crm.test', 'phone', 'SRS', 'Aditya Verma', 'aditya.verma@srs-tech.in',      '+91-98400-50001'],
      ['Asteroid system MN-1 server slot 15, one HDD is showing predictive failure.',
       'SMART warning on slot 15 HDD; needs replacement before total failure.',
       'With Hardware Team', 'critical', 'rohan@crm.test', 'phone', 'Asteroid', 'Sneha Iyer', 'sneha.iyer@asteroid.in', '+91-98400-50002'],
      ['The recon log size is increasing continuously.',
       'recon-svc log file growing 2GB/day on prod-01; needs rotation tuning.',
       'In Progress', 'high', 'karthik@crm.test', 'email', 'NTT', 'Vivek Patel', 'vivek.patel@ntt-india.in',             '+91-98400-50005'],
      ['The Astroid Probe-3 server is unreachable.',
       'Probe-3 not responding to pings since 06:30 IST. Possible NIC failure.',
       'New', 'critical', 'nigam@crm.test', 'phone', 'Asteroid', 'Sneha Iyer', 'sneha.iyer@asteroid.in',                 '+91-98400-50002'],
      ['In SRS Probe-11, ipdecoding is not working.',
       'IP decode pipeline silently dropping packets. Investigation needed.',
       'In Progress', 'high', 'priya@crm.test', 'portal', 'SRS', 'Aditya Verma', 'aditya.verma@srs-tech.in',             '+91-98400-50001'],
      ['Logstash file count increases in Galaxy.',
       'Logstash output dir on Galaxy site shows >50k pending files.',
       'In Progress', 'high', 'aarav@crm.test', 'email', 'Galaxy', 'Rahul Khanna', 'rahul.khanna@galaxy-solutions.in',   '+91-98400-50003'],
      ['GTP Enhancement for SRS',
       'Customer requested GTP module enhancement: see attached spec.',
       'New', 'low', 'nigam@crm.test', 'portal', 'SRS', 'Aditya Verma', 'aditya.verma@srs-tech.in',                      '+91-98400-50001'],
      ['Mahawali plant sensor offline (Line-3)',
       'IoT sensor on Line-3 not pushing data since 06:00 IST.',
       'With Hardware Team', 'critical', 'rohan@crm.test', 'phone', 'Mahawali', 'Meera Pillai', 'meera.pillai@mahawali.in', '+91-98400-50004'],
      ['Orange MPLS link flapping (Mumbai POP)',
       'Customer reports intermittent connectivity at Mumbai POP.',
       'New', 'high', 'divya@crm.test', 'phone', 'Orange', 'Ananya Bose', 'ananya.bose@orange-india.in',                 '+91-98400-50006'],
      ['Galaxy — invoice PDF download fails',
       'Random 500 from /v1/invoice/:id/pdf endpoint.',
       'Closed', 'medium', 'karthik@crm.test', 'email', 'Galaxy', 'Rahul Khanna', 'rahul.khanna@galaxy-solutions.in',    '+91-98400-50003'],
    ];

    const slaHours = { critical: 4, high: 8, medium: 24, low: 72 };
    const stageToStatus = {
      'New':                  'open',
      'In Progress':          'in_progress',
      'Waiting for Customer': 'waiting',
      'With Hardware Team':   'in_progress',
      'Closed':               'closed',
      'Reopen':               'open',
      'Merged':               'closed',
    };

    for (const [subject, desc, stageName, priority, engEmail, source, projName, repName, repEmail, repPhone] of demos) {
      const eng  = userByEmail[engEmail];
      const proj = projByName[projName];
      if (!eng || !proj) continue;
      const stageId = stagesByName[stageName] || stagesByName['New'];
      const status  = stageToStatus[stageName] || 'open';
      await query(
        `INSERT INTO tickets
            (subject, description, status, priority,
             pipeline_id, pipeline_stage_id,
             assigned_to, assigned_engineer_id, reporting_manager_id,
             project_id, project_manager_id, location_id, team_id, source,
             reporter_name, reporter_email, reporter_phone,
             sla_due_at, created_by,
             resolved_at, closed_at)
         VALUES ($1, $2, $3::varchar, $4::varchar,
                 $5, $6,
                 $7, $7, $8,
                 $9, $10, $11, $12, $13::varchar,
                 $14, $15, $16,
                 NOW() + ($17 || ' hours')::INTERVAL, $18,
                 CASE WHEN $3::varchar IN ('resolved','closed') THEN NOW() ELSE NULL END,
                 CASE WHEN $3::varchar = 'closed' THEN NOW() ELSE NULL END)`,
        [
          subject, desc, status, priority,
          defaultPipelineId, stageId,
          eng.id, eng.manager_id,
          proj.id, proj.project_manager_id, proj.location_id, eng.team_id, source,
          repName, repEmail, repPhone,
          String(slaHours[priority] || 24), adminId,
        ]);
    }
  }

  /* --------------------------------------------------------------- TASKS */
  if ((await query('SELECT COUNT(*)::int AS c FROM tasks')).rows[0].c === 0) {
    const salesId = (await query(`SELECT id FROM users WHERE email='sales@crm.test'`)).rows[0]?.id;
    const adminId = (await query(`SELECT id FROM users WHERE email='admin@crm.test'`)).rows[0]?.id;
    await query(
      `INSERT INTO tasks (title,description,due_date,priority,status,assigned_to,created_by) VALUES
        ('Follow up with TCS — Service Desk RFP',  'Call Aditya about clause changes',  NOW() + INTERVAL '2 days', 'high','pending',$1,$2),
        ('Prepare Q2 India revenue report',         'Finalise & circulate to leadership', NOW() + INTERVAL '5 days','medium','pending',$1,$2),
        ('Schedule demo with Reliance IoT team',    'Send Google Meet calendar invite',   NOW() + INTERVAL '1 day', 'high','in_progress',$1,$2)`,
      [salesId, adminId]);
  }

  /* ------------------------------------------------------------ SETTINGS */
  // Core app settings (India defaults)
  await query(
    `INSERT INTO settings (key, value) VALUES
      ('app.name',     '"Modern CRM"'::jsonb),
      ('app.currency', '"INR"'::jsonb),
      ('app.timezone', '"Asia/Kolkata"'::jsonb),
      ('app.country',  '"India"'::jsonb)
     ON CONFLICT (key) DO NOTHING`);

  // Configurable SLA policy — admin-editable from Settings → SLA tab
  await query(
    `INSERT INTO settings (key,value) VALUES ('sla.policy', $1::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify({
      critical: { response_minutes: 15,  resolution_hours: 4,  business_hours: false },
      high:     { response_minutes: 30,  resolution_hours: 8,  business_hours: false },
      medium:   { response_minutes: 60,  resolution_hours: 24, business_hours: true  },
      low:      { response_minutes: 240, resolution_hours: 72, business_hours: true  },
    })]);

  // Email-notification defaults
  await query(
    `INSERT INTO settings (key,value) VALUES ('email.notify', $1::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify({
      ticket_created: true,
      ticket_closed:  true,
      from_name:      'CRM Support',
      from_email:     'no-reply@crm.test',
    })]);

  console.log('[seed] done.');
  console.log('[seed] Demo logins (India):');
  console.log('       admin@crm.test       / admin123       (admin   — Arjun Kumar, Chennai)');
  console.log('       manager@crm.test     / manager123     (manager — Vikram Iyer, Chennai Support)');
  console.log('       sales@crm.test       / sales123       (sales   — Riya Sharma, Mumbai)');
  console.log('       nigam@crm.test       / nigam123       (engineer— Nigam Behera, Chennai Support)');
  console.log('       aarav@crm.test       / aarav123       (engineer— Aarav Pillai, Chennai Support)');
  console.log('       karthik@crm.test     / karthik123     (engineer— Karthik Raman, Chennai Support)');
  console.log('       anitha@crm.test      / anitha123      (manager — Anitha Krishnan, Bengaluru)');
  console.log('       rohan@crm.test       / rohan123       (engineer— Rohan Mehta, Bengaluru)');
  console.log('       priya@crm.test       / priya123       (engineer— Priya Reddy, Bengaluru)');
  console.log('       suresh@crm.test      / suresh123      (manager — Suresh Nair, Hyderabad)');
  console.log('       divya@crm.test       / divya123       (engineer— Divya Menon, Hyderabad)');
  console.log('       Project Managers (rajesh|lakshmi|mohan|bhavna|sandeep|kavya).pm@crm.test / <name>123');

  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
