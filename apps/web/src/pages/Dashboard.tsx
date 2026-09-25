import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, DocumentItem } from '../api';

export default function Dashboard() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { documents } = await api.listDocuments();
    setDocuments(documents);
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000); // poll while documents are processing
    return () => clearInterval(timer);
  }, []);

  async function submitText(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.uploadText(title, text);
      setTitle('');
      setText('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitFile() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await api.uploadFile(title || file.name, file);
      setTitle('');
      if (fileInput.current) fileInput.current.value = '';
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.deleteDocument(id);
    await refresh();
  }

  return (
    <main className="page">
      <section className="card">
        <h2>Add a document</h2>
        <form onSubmit={submitText}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            placeholder="Paste text here, or pick a file below (.txt, .md, .pdf)" />
          <div className="row">
            <input ref={fileInput} type="file" accept=".txt,.md,.pdf" onChange={() => { if (!title && fileInput.current?.files?.[0]) setTitle(fileInput.current.files[0].name.replace(/\.[^.]+$/, '')); }} />
            <button type="button" className="btn" onClick={submitFile} disabled={busy}>Upload file</button>
            <button type="submit" className="btn btn-primary" disabled={busy || text.trim().length < 20}>
              {busy ? 'Indexing...' : 'Index text'}
            </button>
          </div>
          {error && <div className="error">{error}</div>}
        </form>
      </section>

      <section>
        <h2>Your documents ({documents.length})</h2>
        <div className="doc-grid">
          {documents.map((doc) => (
            <div className="doc-card" key={doc.id}>
              <div className="doc-title">{doc.title}</div>
              <div className="doc-meta">
                <span className={`status status-${doc.status}`}>{doc.status}</span>
                <span>{doc.chunkCount} chunks</span>
                <span>{doc.sourceType}</span>
              </div>
              <div className="doc-meta muted">{new Date(doc.createdAt).toLocaleString()}</div>
              <button className="btn btn-ghost" onClick={() => remove(doc.id)}>Delete</button>
            </div>
          ))}
          {documents.length === 0 && <p className="muted">No documents yet. Add one above, then ask questions about it.</p>}
        </div>
      </section>
    </main>
  );
}
