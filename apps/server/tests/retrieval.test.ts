import { describe, it, expect } from 'vitest';
import { rankChunks } from '../src/lib/retrieval';
import { localEmbed } from '../src/lib/embeddings';

const makeChunk = (id: string, text: string) => ({
  id,
  documentId: 'doc-1',
  documentTitle: 'Handbook',
  index: 0,
  text,
  embedding: localEmbed(text),
});

describe('rankChunks', () => {
  it('orders chunks by cosine similarity and limits to k', () => {
    const chunks = [
      makeChunk('a', 'travel expenses are reimbursed up to 65 dollars per day'),
      makeChunk('b', 'parental leave is 16 weeks fully paid for the primary caregiver'),
      makeChunk('c', 'business travel meal expenses and reimbursements policy'),
    ];
    const ranked = rankChunks(localEmbed('meal expense reimbursement'), chunks, 2);
    expect(ranked).toHaveLength(2);
    expect(['a', 'c']).toContain(ranked[0].id);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('handles an empty corpus', () => {
    expect(rankChunks(localEmbed('anything'), [], 5)).toEqual([]);
  });
});
