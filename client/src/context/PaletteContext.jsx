import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ---------------------------------------------------------------------------
 *  PaletteContext — central state for the global command palette and the
 *  per-page "create new" hotkey.
 *
 *  Pages call useCreateHandler(fn, label) to advertise what "N" should do
 *  on their screen (e.g. open the create-ticket drawer).  The palette uses
 *  the same handler for its "Create new" quick action so the two stay in
 *  perfect sync.
 * ----------------------------------------------------------------------- */

const PaletteContext = createContext(null);

export function PaletteProvider({ children }) {
  const [open, setOpen] = useState(false);
  const handlerRef = useRef(null);  // { fn, label, key } | null
  const [handlerLabel, setHandlerLabel] = useState(null);

  const openPalette  = useCallback(() => setOpen(true),  []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((v) => !v), []);

  const setCreateHandler = useCallback((fn, label) => {
    handlerRef.current = fn ? { fn, label } : null;
    setHandlerLabel(fn ? (label || 'Create new') : null);
  }, []);

  const triggerCreate = useCallback(() => {
    const h = handlerRef.current;
    if (h && typeof h.fn === 'function') {
      h.fn();
      return true;
    }
    return false;
  }, []);

  return (
    <PaletteContext.Provider value={{
      open, openPalette, closePalette, togglePalette,
      setCreateHandler, triggerCreate,
      createLabel: handlerLabel,
    }}>
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('usePalette must be used inside <PaletteProvider>');
  return ctx;
}

/**
 * Tell the palette / "N" hotkey what "create new" means on this page.
 * Call inside a list page once: useCreateHandler(openDrawer, 'Create ticket').
 * Cleanup is automatic on unmount.
 */
export function useCreateHandler(fn, label) {
  const { setCreateHandler } = usePalette();
  useEffect(() => {
    setCreateHandler(fn, label);
    return () => setCreateHandler(null, null);
  }, [fn, label, setCreateHandler]);
}
