import { useEffect } from 'react';

/* ---------------------------------------------------------------------------
 *  useHotkey — small, focused keyboard shortcut hook.
 *
 *  Why not a heavyweight library?  We only need a handful of shortcuts and
 *  they all behave the same way: do nothing while the user is typing in a
 *  text field / contenteditable, and let the browser do everything else.
 *
 *  Shortcut spec is a string like:
 *    'mod+k'           → cmd on mac, ctrl elsewhere
 *    'ctrl+k'          → strict ctrl
 *    'shift+/'         → shift + /
 *    'n'               → bare key
 *    'esc'             → friendly alias for 'escape'
 *  Multiple alternatives are space- or comma-separated: 'mod+k k'.
 *
 *  All comparisons are case-insensitive on the main key; modifiers are
 *  matched exactly (so 'k' alone won't fire if Ctrl is pressed).
 * ----------------------------------------------------------------------- */

const KEY_ALIASES = {
  esc: 'escape',
  ret: 'enter',
  return: 'enter',
  spc: ' ',
  space: ' ',
};

function normaliseKey(k) {
  const lower = String(k).toLowerCase();
  return KEY_ALIASES[lower] || lower;
}

function parseSpec(spec) {
  return String(spec)
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.toLowerCase().split('+').map((p) => p.trim()).filter(Boolean);
      const key = normaliseKey(parts.pop());
      return {
        key,
        mod:   parts.includes('mod'),
        ctrl:  parts.includes('ctrl'),
        meta:  parts.includes('meta') || parts.includes('cmd'),
        shift: parts.includes('shift'),
        alt:   parts.includes('alt') || parts.includes('option'),
      };
    });
}

function matches(combo, e) {
  const eventKey = normaliseKey(e.key);
  if (eventKey !== combo.key) return false;
  // 'mod' ↔ ctrl on win/linux, meta on macOS.
  if (combo.mod) {
    const isMac = typeof navigator !== 'undefined' &&
                  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
    const wantsMod = isMac ? e.metaKey : e.ctrlKey;
    if (!wantsMod) return false;
  } else {
    if (combo.ctrl !== e.ctrlKey) return false;
    if (combo.meta !== e.metaKey) return false;
  }
  if (combo.shift !== e.shiftKey) return false;
  if (combo.alt   !== e.altKey)   return false;
  return true;
}

function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return false;
}

/**
 * @param {string|string[]} spec  shortcut combo(s)
 * @param {(e: KeyboardEvent) => void} handler
 * @param {object} [opts]
 * @param {boolean} [opts.allowInInputs=false]  fire even when focus is inside <input>/<textarea>
 * @param {boolean} [opts.enabled=true]         disable without unmounting
 * @param {boolean} [opts.preventDefault=true]
 */
export default function useHotkey(spec, handler, opts = {}) {
  const { allowInInputs = false, enabled = true, preventDefault = true } = opts;

  useEffect(() => {
    if (!enabled) return undefined;
    const combos = Array.isArray(spec) ? spec.flatMap(parseSpec) : parseSpec(spec);
    if (combos.length === 0) return undefined;

    const onKey = (e) => {
      if (!allowInInputs && isTypingTarget(e.target)) return;
      if (!combos.some((c) => matches(c, e))) return;
      if (preventDefault) e.preventDefault();
      handler(e);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, handler, allowInInputs, enabled, preventDefault]);
}
