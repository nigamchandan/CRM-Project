/**
 * Email service for ticket notifications.
 *
 * Reads SMTP config from process.env. If SMTP_HOST is not set the service
 * runs in **dry-run mode**: it logs the would-be email to the console but
 * does NOT throw, so the rest of the app keeps working without real SMTP.
 *
 * Environment variables (all optional in dry-run):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 *   MAIL_FROM (e.g. "CRM Support <no-reply@crm.test>")
 */
const nodemailer = require('nodemailer');
const settingsSvc = require('./settings.service');

let transporter = null;
let configured  = false;

function init() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    configured = false;
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port:   Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  configured = true;
  return transporter;
}

async function getNotifySettings() {
  try {
    const all = await settingsSvc.getAll();
    return all['email.notify'] || {};
  } catch {
    return {};
  }
}

function uniqEmails(arr) {
  return [...new Set((arr || []).filter(Boolean).map((s) => String(s).trim().toLowerCase()))];
}

function fmtAddr(name, email) {
  return name ? `${name} <${email}>` : email;
}

/**
 * Send an email.
 *  - In dry-run mode just logs and resolves with { dryRun: true }.
 */
async function send({ to, cc, subject, html, text }) {
  const recipients = uniqEmails(Array.isArray(to) ? to : [to]);
  const ccList     = uniqEmails(Array.isArray(cc) ? cc : cc ? [cc] : []);
  if (!recipients.length) return { skipped: true, reason: 'no recipients' };

  init();
  const notify = await getNotifySettings();
  const fromName  = notify.from_name  || 'CRM Support';
  const fromEmail = notify.from_email || 'no-reply@crm.test';
  const from = process.env.MAIL_FROM || fmtAddr(fromName, fromEmail);

  if (!configured || !transporter) {
    // eslint-disable-next-line no-console
    console.log(`[email:dry-run] to=${recipients.join(',')} cc=${ccList.join(',')} subject="${subject}"`);
    return { dryRun: true, to: recipients, cc: ccList, subject };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to:  recipients.join(','),
      cc:  ccList.length ? ccList.join(',') : undefined,
      subject,
      text: text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''),
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed:', err.message);
    return { error: err.message };
  }
}

/* ---------------- Templates ---------------------------------------------- */

function badge(text, color) {
  return `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;background:${color};color:#fff;font-size:12px;font-weight:600;letter-spacing:.3px">${text}</span>`;
}
const PRIORITY_COLOR = {
  critical: '#dc2626',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#16a34a',
};

function shell({ title, intro, ticket, ctaUrl, footer }) {
  const pri = String(ticket.priority || 'medium').toLowerCase();
  const created = new Date(ticket.created_at || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const due     = ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—';
  const closed  = ticket.closed_at  ? new Date(ticket.closed_at).toLocaleString('en-IN',  { timeZone: 'Asia/Kolkata' }) : null;
  return `
<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="padding:20px 24px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff">
        <div style="font-size:13px;opacity:.9;letter-spacing:.6px;text-transform:uppercase">CRM • Support</div>
        <div style="font-size:22px;font-weight:700;margin-top:4px">${title}</div>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 16px 0;color:#374151">${intro}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6b7280;width:160px">Ticket</td><td><strong>${ticket.ticket_no || `#${ticket.id}`}</strong> — ${ticket.subject || ''}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Project</td><td>${ticket.project_name || '—'} ${ticket.project_code ? `<span style="color:#6b7280">(${ticket.project_code})</span>` : ''}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Customer</td><td>${ticket.customer_name || ticket.reporter_name || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Source</td><td>${ticket.source || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Priority</td><td>${badge(pri.toUpperCase(), PRIORITY_COLOR[pri] || '#6b7280')}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Status</td><td>${badge((ticket.status || 'open').toUpperCase(), '#4338ca')}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Engineer</td><td>${ticket.engineer_name || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Project Manager</td><td>${ticket.project_manager_name || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Created</td><td>${created} IST</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">SLA Due</td><td>${due} IST</td></tr>
          ${closed ? `<tr><td style="padding:6px 0;color:#6b7280">Closed</td><td>${closed} IST</td></tr>` : ''}
        </table>
        ${ticket.description ? `
        <div style="margin-top:16px;padding:14px 16px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;color:#374151;font-size:14px;line-height:1.5">
          <div style="font-size:12px;color:#6b7280;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">Description</div>
          ${String(ticket.description).replace(/</g, '&lt;')}
        </div>` : ''}
        ${ctaUrl ? `
        <div style="margin-top:20px">
          <a href="${ctaUrl}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:600">Open ticket</a>
        </div>` : ''}
      </div>
      <div style="padding:14px 24px;background:#f9fafb;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb">
        ${footer || 'You are receiving this because you are associated with this ticket.'}
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Build the recipient list for a ticket notification.
 *   to: customer/reporter (so they get a copy)
 *   cc: engineer + reporting manager + project manager + (creator)
 */
function recipientsFor(ticket) {
  const to = uniqEmails([ticket.reporter_email]);
  const cc = uniqEmails([
    ticket.engineer_email,
    ticket.reporting_manager_email,
    ticket.project_manager_email,
    ticket.creator_email,
  ]);
  if (!to.length && cc.length) {
    return { to: [cc[0]], cc: cc.slice(1) };
  }
  return { to, cc };
}

exports.sendTicketCreated = async (ticket, { clientUrl } = {}) => {
  const notify = await getNotifySettings();
  if (notify.ticket_created === false) return { skipped: true };
  const { to, cc } = recipientsFor(ticket);
  if (!to.length && !cc.length) return { skipped: true, reason: 'no recipients' };
  const ctaUrl = clientUrl ? `${clientUrl}/tickets/${ticket.id}` : null;
  return send({
    to, cc,
    subject: `[${ticket.ticket_no || `Ticket #${ticket.id}`}] ${ticket.subject} — ${String(ticket.priority || '').toUpperCase()}`,
    html: shell({
      title:  `New ticket opened`,
      intro:  `A new ticket has been created on the CRM. Details below.`,
      ticket,
      ctaUrl,
    }),
  });
};

exports.sendTicketClosed = async (ticket, { clientUrl } = {}) => {
  const notify = await getNotifySettings();
  if (notify.ticket_closed === false) return { skipped: true };
  const { to, cc } = recipientsFor(ticket);
  if (!to.length && !cc.length) return { skipped: true, reason: 'no recipients' };
  const ctaUrl = clientUrl ? `${clientUrl}/tickets/${ticket.id}` : null;
  return send({
    to, cc,
    subject: `[${ticket.ticket_no || `Ticket #${ticket.id}`}] Closed — ${ticket.subject}`,
    html: shell({
      title:  `Ticket resolved & closed`,
      intro:  `The ticket below has been closed. If the issue persists, please reply or reopen.`,
      ticket,
      ctaUrl,
      footer: 'Thank you for working with our support team.',
    }),
  });
};

exports.send = send;
exports.isConfigured = () => { init(); return configured; };
