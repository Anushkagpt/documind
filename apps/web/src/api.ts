const TOKEN_KEY = 'documind_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface DocumentItem {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  chunkCount: number;
  createdAt: string;
}

export interface AskSource {
  ref: number;
  documentTitle: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

export interface AskResponse {
  answer: string;
  sources: AskSource[];
  provider: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 401) {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { email: string; name: string | null } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: { email: string; name: string | null } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  listDocuments: () => request<{ documents: DocumentItem[] }>('/documents'),
  uploadText: (title: string, text: string) =>
    request<{ document: DocumentItem }>('/documents', { method: 'POST', body: JSON.stringify({ title, text }) }),
  uploadFile: (title: string, file: File) => {
    const form = new FormData();
    form.append('title', title);
    form.append('file', file);
    return request<{ document: DocumentItem }>('/documents', { method: 'POST', body: form });
  },
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),
  ask: (question: string, documentId?: string) =>
    request<AskResponse>('/ask', { method: 'POST', body: JSON.stringify({ question, documentId }) }),
  recentQuestions: () => request<{ recent: { question: string; createdAt: string }[] }>('/ask/recent'),
  health: () => request<{ ok: boolean; provider: string; mode: string }>('/health'),
};
