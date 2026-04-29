import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import CommandPalette from '../palette/CommandPalette.jsx';
import { usePalette } from '../../context/PaletteContext.jsx';
import useHotkey from '../../hooks/useHotkey.js';

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { open: paletteOpen, togglePalette, openPalette, triggerCreate } = usePalette();

  // ⌘K / Ctrl+K — open the global command palette from anywhere.
  // We pass `allowInInputs: true` so the user can also fire it while focused
  // in a search box (matches Linear / GitHub behaviour).
  useHotkey('mod+k', togglePalette, { allowInInputs: true });

  // "N" — create a new entity contextual to the current page.  Disabled
  // while the palette is already open so its own ↑/↓/n typing isn't hijacked.
  useHotkey('n', () => triggerCreate(), { enabled: !paletteOpen });

  // Forward-slash — focus a quick-search style entry into the palette,
  // similar to GitHub's '/' shortcut.
  useHotkey('/', openPalette, { enabled: !paletteOpen });

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950">
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setOpen(true)} />
        {/*
          Layout sizing notes:
          - Horizontal padding is a flat px-4 (16px) at every breakpoint so the
            main content edge aligns with the topbar search/avatars and we don't
            waste real estate on wide monitors.
          - max-w only kicks in on ≥2K displays so 1366–1920 monitors render
            edge-to-edge while 4K still avoids mile-long lines.
        */}
        <main className="flex-1 px-4 py-4 md:py-6">
          <div className="max-w-[1920px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
