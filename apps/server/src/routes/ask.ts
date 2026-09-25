import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getStore } from '../lib/store';
import { embedOne, generateText } from '../lib/gemini';
import { rankChunks } from '../lib/retrieval';
import { tokenize } from '../lib/embeddings';
import { aiProvider } from '../config';

const router = Router();
router.use(requireAuth);

const askBody = z.object({
  question: z.string().min(3).max(2000),
  documentId: z.string().optional(),
});

function buildPrompt(question: string, sources: { title: string; text: string }[]): string {
  const context = sources.map((s, i) => `[${i + 1}] (from "${s.title}")\n${s.text}`).join('\n\n');
  return [
    'You are DocuMind, an assistant that answers questions strictly from the document excerpts below.',
    'Rules: only use the excerpts. If the answer is not in them, say you could not find it in the uploaded documents.',
    'Cite the excerpts you used inline, like [1] or [2]. Answer in 2-6 sentences.',
    '',
    'Excerpts:',
    context,
    '',
    `Question: ${question}`,
  ].join('\n');
}

/**
 * Offline extractive answer: sentence-level retrieval inside the strongest
 * chunk, so the quoted passage actually addresses the question.
 */
function extractiveAnswer(question: string, sources: { text: string; score: number }[]): string {
  const queryTokens = new Set(tokenize(question).filter((t) => !STOPWORDS.has(t)));
  // Drop header lines (short, no terminal punctuation) before sentence splitting.
  const body = sources[0].text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !(l.length < 70 && !/[.!?,:;]$/.test(l)))
    .join(' ');
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20 && s.split(' ').length >= 5);
  const scored = sentences
    .map((sentence, i) => {
      const tokens = tokenize(sentence);
      const hits = tokens.filter((t) => queryTokens.has(t)).length;
      return { sentence: sentence.trim(), i, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.i - b.i);
  const picked = scored.slice(0, 2).sort((a, b) => a.i - b.i).map((s) => s.sentence);
  const passage = (picked.length ? picked.join(' ') : sources[0].text.slice(0, 300)).trim();
  const trimmed = passage.length > 500 ? passage.slice(0, 500) + '...' : passage;
  return `Offline mode (no AI key configured), so here is the most relevant passage instead of a generated answer: "${trimmed}" [1]`;
}

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'is', 'are', 'do', 'does', 'how', 'what', 'many', 'much', 'for', 'on', 'and', 'or', 'get', 'gets', 'can', 'i', 'we', 'you', 'they', 'their', 'there', 'it', 'its', 'per', 'any', 'all', 'if', 'when', 'with', 'by', 'at', 'as', 'be', 'this', 'that']);

router.post('/', async (req: AuthedRequest, res) => {
  const parsed = askBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { question, documentId } = parsed.data;
  const store = getStore();

  const chunks = await store.chunksForUser(req.userId!, documentId);
  if (chunks.length === 0) {
    res.status(422).json({ error: 'No indexed documents yet - upload one first' });
    return;
  }

  const queryEmbedding = await embedOne(question);
  const ranked = rankChunks(queryEmbedding, chunks, 5);

  let answer: string;
  if (aiProvider === 'gemini') {
    try {
      answer = await generateText(buildPrompt(question, ranked.map((r) => ({ title: r.documentTitle, text: r.text }))));
    } catch (error) {
      answer = extractiveAnswer(question, ranked);
      console.error('Gemini answer failed, used extractive fallback:', (error as Error).message);
    }
  } else {
    answer = extractiveAnswer(question, ranked);
  }

  const sources = ranked.map((r, i) => ({
    ref: i + 1,
    documentTitle: r.documentTitle,
    chunkIndex: r.index,
    score: Number(r.score.toFixed(3)),
    snippet: r.text.slice(0, 240),
  }));

  await store.logQuery(req.userId!, question, answer, aiProvider);
  res.json({ answer, sources, provider: aiProvider });
});

router.get('/recent', async (req: AuthedRequest, res) => {
  const store = getStore();
  res.json({ recent: await store.recentQueries(req.userId!, 10) });
});

export default router;
