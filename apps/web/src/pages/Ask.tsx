import { FormEvent, useEffect, useState } from 'react';
import { api, AskResponse } from '../api';

interface Turn {
  question: string;
  response: AskResponse;
}

export default function Ask() {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    api.recentQuestions().then((r) => setRecent(r.recent.map((q) => q.question))).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.ask(question);
      setTurns((t) => [{ question, response }, ...t]);
      setQuestion('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h2>Ask your documents</h2>
        <form onSubmit={submit} className="ask-form">
          <input value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder='e.g. "How many days of PTO do employees get?"' required minLength={3} />
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Thinking...' : 'Ask'}</button>
        </form>
        {error && <div className="error">{error}</div>}
        {recent.length > 0 && turns.length === 0 && (
          <div className="recent">
            <span className="muted">Recent: </span>
            {recent.slice(0, 4).map((q) => (
              <button key={q} className="chip" onClick={() => setQuestion(q)}>{q}</button>
            ))}
          </div>
        )}
      </section>

      {turns.map((turn, i) => (
        <section className="card turn" key={i}>
          <div className="q">Q: {turn.question}</div>
          <div className="a">{turn.response.answer}</div>
          <div className="sources">
            <div className="muted">Sources ({turn.response.provider === 'gemini' ? 'Gemini answer' : 'offline ranking'}):</div>
            {turn.response.sources.map((s) => (
              <details key={s.ref} className="source">
                <summary>
                  [{s.ref}] {s.documentTitle} - chunk {s.chunkIndex} (score {s.score})
                </summary>
                <p>{s.snippet}...</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
