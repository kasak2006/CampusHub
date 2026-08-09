import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { IconSprite } from './components/Icons.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import Clubs from './pages/Clubs.jsx';
import ClubForm from './pages/ClubForm.jsx';
import ClubDetail from './pages/ClubDetail.jsx';
import Events from './pages/Events.jsx';
import EventForm from './pages/EventForm.jsx';
import EventDetail from './pages/EventDetail.jsx';

/**
 * Root component. Public/auth pages render standalone; authenticated pages
 * render inside the AppLayout shell (sidebar + topbar) behind a ProtectedRoute.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <IconSprite />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Authenticated app shell */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/clubs" element={<Clubs />} />
              <Route path="/clubs/new" element={<ClubForm />} />
              <Route path="/clubs/:id" element={<ClubDetail />} />
              <Route path="/clubs/:id/edit" element={<ClubForm />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/new" element={<EventForm />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/events/:id/edit" element={<EventForm />} />
            </Route>
          </Routes>
          <ThemeToggle />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
