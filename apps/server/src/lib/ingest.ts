import { splitIntoChunks } from './chunker';
import { embedTexts } from './gemini';
import { tokenize } from './embeddings';
import { getStore } from './store';

/**
 * Chunk + embed a document and persist the vectors. Shared by the BullMQ
 * worker (when REDIS_URL is set) and the inline fallback path.
 */
export async function ingestDocument(documentId: string, text: string): Promise<void> {
  const store = getStore();
  try {
    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) throw new Error('Document has no usable text');
    const embeddings = await embedTexts(chunks.map((c) => c.text));
    await store.replaceChunks(
      documentId,
      chunks.map((c, i) => ({
        documentId,
        index: c.index,
        text: c.text,
        embedding: embeddings[i],
        tokenCount: tokenize(c.text).length,
      })),
    );
    await store.setDocumentStatus(documentId, 'ready', chunks.length);
  } catch (error) {
    await store.setDocumentStatus(documentId, 'failed', 0, (error as Error).message);
    throw error;
  }
}
