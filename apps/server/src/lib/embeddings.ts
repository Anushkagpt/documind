/**
 * Embedding providers. With GEMINI_API_KEY set we call the Gemini embedding
 * model; without it we fall back to a deterministic hashed bag-of-words
 * embedder so the whole app (search included) still works offline.
 */

export const LOCAL_DIMS = 384;

/** FNV-1a hash: tiny, fast, deterministic across runs and machines. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Light stemming: fold simple plurals so "policies" matches "policy". */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y';
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss') && !token.endsWith('us') && !token.endsWith('is')) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
    .map(stem);
}

/** Deterministic term-frequency vector in `dims` dimensions, L2-normalized. */
export function localEmbed(text: string, dims = LOCAL_DIMS): number[] {
  const vector = new Array<number>(dims).fill(0);
  for (const token of tokenize(text)) {
    const h = fnv1a(token);
    const bucket = h % dims;
    // Sign from a second bit of the hash reduces bucket collisions' bias.
    vector[bucket] += h & 0x100 ? 1 : -1;
  }
  return normalize(vector);
}

export function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
