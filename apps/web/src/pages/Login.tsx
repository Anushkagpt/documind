import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result =
        mode === 'login' ? await api.login(email, password) : await api.register(email, password, name);
      setToken(result.token);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function useDemo() {
    setMode('login');
    setEmail('demo@documind.dev');
    setPassword('password123');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1><span className="brand-mark">◈</span> DocuMind</h1>
        <p className="muted">Upload documents. Ask questions. Get answers with citations.</p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)" required minLength={8} />
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'One moment...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <div className="auth-alt">
          {mode === 'login' ? (
            <>New here? <button className="link" onClick={() => setMode('register')}>Create an account</button></>
          ) : (
            <>Have an account? <button className="link" onClick={() => setMode('login')}>Log in</button></>
          )}
        </div>
        <button className="btn btn-demo" onClick={useDemo}>Fill demo credentials</button>
        <p className="hint">Demo account: demo@documind.dev / password123 (seeded with two sample documents)</p>
      </div>
    </div>
  );
}
