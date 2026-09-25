import { config, aiProvider } from '../config';
import { localEmbed } from './embeddings';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGemini(model: string, action: string, body: unknown): Promise<any> {
  const url = `${API_BASE}/${model}:${action}?key=${config.geminiApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini ${action} failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.json();
}

/** Embed a batch of texts. Falls back to the local embedder without a key. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (aiProvider === 'local' || texts.length === 0) {
    return texts.map((t) => localEmbed(t));
  }
  const data = await callGemini(config.geminiEmbeddingModel, 'batchEmbedContents', {
    requests: texts.map((text) => ({
      model: `models/${config.geminiEmbeddingModel}`,
      content: { parts: [{ text }] },
    })),
  });
  return (data.embeddings || []).map((e: any) => e.values as number[]);
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

/** Free-form text generation (used for answers). */
export async function generateText(prompt: string): Promise<string> {
  const data = await callGemini(config.geminiModel, 'generateContent', {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  });
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p: any) => p.text || '').join('').trim();
}
