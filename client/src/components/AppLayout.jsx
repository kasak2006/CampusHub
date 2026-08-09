import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

/**
 * Authenticated app shell: fixed sidebar + glassy topbar wrapping the routed
 * page content. Public/auth pages render outside this shell.
 */
export default function AppLayout() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
