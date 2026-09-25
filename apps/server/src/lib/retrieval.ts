import { cosineSimilarity } from './embeddings';

export interface RankedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  index: number;
  text: string;
  score: number;
}

interface StoredChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  index: number;
  text: string;
  embedding: number[];
}

/** Cosine-rank chunks against a query embedding and keep the top k. */
export function rankChunks(queryEmbedding: number[], chunks: StoredChunk[], k = 5): RankedChunk[] {
  return chunks
    .map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      index: chunk.index,
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
