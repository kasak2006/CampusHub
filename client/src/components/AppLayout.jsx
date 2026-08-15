import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

/**
 * Authenticated app shell: fixed sidebar + glassy topbar wrapping the routed
 * page content. On mobile the sidebar collapses into a slide-in drawer toggled
 * from the topbar; it closes automatically on navigation. Public/auth pages
 * render outside this shell.
 */
export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <Sidebar open={drawerOpen} />
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="main">
        <Topbar onMenu={() => setDrawerOpen((v) => !v)} />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
