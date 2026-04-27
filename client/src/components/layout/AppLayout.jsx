import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950">
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setOpen(true)} />
        {/*
          Layout sizing notes:
          - Horizontal padding stays at p-6 even on lg screens (was lg:p-8) so we
            don't add extra chrome on wider monitors.
          - max-w bumped to 1920px and only kicks in on ultra-wide displays
            (≥ 2K), keeping a normal 1366–1920 monitor content edge-to-edge while
            still avoiding mile-long lines on a 4K screen.
        */}
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
          <div className="max-w-[1920px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
