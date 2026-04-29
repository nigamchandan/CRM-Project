require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('../config/db');

/* ============================================================================
 *  Idempotent schema migrator.
 *
 *  Why this is split-by-statement instead of a single pool.query(sql):
 *    - schema.sql is dozens of statements long, and a single failing one
 *      historically aborted the entire run, leaving newer ALTERs (e.g.
 *      `ticket_type`) un-applied on the production DB.
 *    - Running each statement in its own request lets us log which one
 *      misbehaved and continue with the rest.
 *
 *  Error policy:
 *    - "Expected" errors on a populated DB (already exists / does not exist
 *      / duplicate column) are logged at INFO level and skipped.
 *    - Anything else is logged loudly but the migrator carries on so a
 *      single broken statement doesn't block the rest of the schema.
 *    - Exit code is 0 unless _every_ statement failed (catastrophic).
 * ========================================================================= */

/**
 * Tiny SQL splitter that understands:
 *   - line comments  (`-- ...`)
 *   - block comments (`/* ... *\/`)
 *   - single-quoted string literals (with `''` escapes)
 *   - PostgreSQL dollar-quoted blocks (`$$ ... $$`, `$tag$ ... $tag$`)
 *
 *  Splits on top-level `;` only.  Returns an array of trimmed statements,
 *  with empty / pure-comment chunks dropped.
 */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  const n = sql.length;
  let inLine = false, inBlock = false, inSingle = false, dollarTag = null;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Line comment
    if (inLine) {
      buf += ch;
      if (ch === '\n') inLine = false;
      i++; continue;
    }
    // Block comment
    if (inBlock) {
      buf += ch;
      if (ch === '*' && next === '/') { buf += next; i += 2; inBlock = false; continue; }
      i++; continue;
    }
    // Single-quoted string
    if (inSingle) {
      buf += ch;
      if (ch === "'" && next === "'") { buf += next; i += 2; continue; } // escaped
      if (ch === "'") inSingle = false;
      i++; continue;
    }
    // Dollar-quoted block (PostgreSQL DO/function bodies)
    if (dollarTag !== null) {
      // Look for the closing $tag$
      if (ch === '$') {
        const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
        if (m && m[1] === (dollarTag || '')) {
          buf += m[0];
          i += m[0].length;
          dollarTag = null;
          continue;
        }
      }
      buf += ch;
      i++; continue;
    }

    // Not currently inside any literal — check for entry into one
    if (ch === '-' && next === '-') { inLine = true; buf += ch; i++; continue; }
    if (ch === '/' && next === '*') { inBlock = true; buf += ch + next; i += 2; continue; }
    if (ch === "'")                   { inSingle = true; buf += ch; i++; continue; }
    if (ch === '$') {
      const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (m) {
        dollarTag = m[1] || '';
        buf += m[0];
        i += m[0].length;
        continue;
      }
    }

    // Top-level statement boundary
    if (ch === ';') {
      const trimmed = buf.trim();
      if (trimmed.length > 0) out.push(trimmed);
      buf = '';
      i++; continue;
    }

    buf += ch;
    i++;
  }

  // Trailing statement without closing semicolon
  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);

  // Drop chunks that are purely comments / whitespace
  return out.filter((stmt) => {
    const stripped = stmt
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\n]*\n?/g, '')
      .trim();
    return stripped.length > 0;
  });
}

/** Short tag used in log lines so we can tell statements apart at a glance. */
function summarise(stmt) {
  const collapsed = stmt.replace(/\s+/g, ' ').trim();
  return collapsed.length > 90 ? `${collapsed.slice(0, 87)}…` : collapsed;
}

/** Errors we can safely shrug off when re-running the schema on an existing DB. */
function isBenignError(err) {
  const code = err?.code;
  // 42P07 duplicate_table, 42710 duplicate_object, 42701 duplicate_column,
  // 42P06 duplicate_schema, 42723 duplicate_function
  if (['42P07', '42710', '42701', '42P06', '42723'].includes(code)) return true;
  // Some deployments hit transient races (e.g., concurrent migrators);
  // surface the noise but don't block the pipeline.
  if (/already exists$/i.test(err?.message || '')) return true;
  return false;
}

(async () => {
  const filePath = path.join(__dirname, 'schema.sql');
  const raw = fs.readFileSync(filePath, 'utf8');
  const statements = splitStatements(raw);

  console.log(`[migrate] applying ${statements.length} statements from schema.sql`);

  let ok = 0, benign = 0, failed = 0;
  const failures = [];

  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx];
    const tag  = `[migrate ${String(idx + 1).padStart(3, '0')}/${statements.length}]`;
    try {
      await pool.query(stmt);
      ok++;
    } catch (err) {
      if (isBenignError(err)) {
        benign++;
        console.log(`${tag} skipped (already applied): ${summarise(stmt)}`);
      } else {
        failed++;
        failures.push({ stmt, err });
        console.error(`${tag} FAILED: ${err.code || ''} ${err.message}`);
        console.error(`${tag}   sql: ${summarise(stmt)}`);
      }
    }
  }

  const total = statements.length;
  console.log(
    `[migrate] done — ok: ${ok}, skipped: ${benign}, failed: ${failed} / ${total}`
  );

  if (failures.length === total) {
    console.error('[migrate] catastrophic — every statement failed. Aborting.');
    process.exit(1);
  }
  if (failures.length > 0) {
    // Print the first few failures clearly so the operator can copy-paste
    // them into a manual psql session if needed.
    console.error('[migrate] some statements failed; service will start anyway.');
    failures.slice(0, 5).forEach((f, i) => {
      console.error(`  ${i + 1}. ${f.err.code || ''} ${f.err.message}`);
    });
  }

  process.exit(0);
})().catch((err) => {
  console.error('[migrate] fatal error:', err);
  process.exit(1);
});
