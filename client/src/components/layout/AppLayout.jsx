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
    </div>
  );
}
