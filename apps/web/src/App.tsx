import { Navigate, Route, Routes, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Ask from './pages/Ask';
import { api, getToken, setToken } from './api';

function Nav({ provider }: { provider: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = () => {
    setToken(null);
    navigate('/login');
  };
  return (
    <nav className="nav">
      <Link to="/" className="brand">
        <span className="brand-mark">◈</span> DocuMind
      </Link>
      <div className="nav-links">
        <Link className={location.pathname === '/' ? 'active' : ''} to="/">Documents</Link>
        <Link className={location.pathname === '/ask' ? 'active' : ''} to="/ask">Ask</Link>
        <span className={`badge ${provider === 'gemini' ? 'badge-ai' : ''}`}>
          {provider === 'gemini' ? 'Gemini AI' : 'offline mode'}
        </span>
        <button className="btn btn-ghost" onClick={logout}>Log out</button>
      </div>
    </nav>
  );
}

export default function App() {
  // Subscribe to location so route guards re-evaluate the token after login/logout.
  useLocation();
  const [provider, setProvider] = useState('local');
  useEffect(() => {
    api.health().then((h) => setProvider(h.provider)).catch(() => {});
  }, []);

  return (
    <div className="shell">
      {getToken() && <Nav provider={provider} />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={getToken() ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/ask" element={getToken() ? <Ask /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}
