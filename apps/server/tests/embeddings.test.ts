import { describe, it, expect } from 'vitest';
import { localEmbed, cosineSimilarity, tokenize, LOCAL_DIMS } from '../src/lib/embeddings';

describe('local embedder', () => {
  it('is deterministic', () => {
    expect(localEmbed('hello world')).toEqual(localEmbed('hello world'));
  });

  it('returns L2-normalized vectors of the configured size', () => {
    const v = localEmbed('some sample text about remote work policies');
    expect(v).toHaveLength(LOCAL_DIMS);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('gives identical texts a cosine similarity of 1', () => {
    const a = localEmbed('parental leave policy');
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  it('ranks related text above unrelated text', () => {
    const query = localEmbed('remote work from home policy');
    const related = localEmbed('employees may work remotely from home four days per week');
    const unrelated = localEmbed('quarterly revenue grew alongside chocolate exports');
    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });
});

describe('tokenize', () => {
  it('lowercases and drops punctuation and one-letter tokens', () => {
    expect(tokenize('Hello, World! A B2B tool.')).toEqual(['hello', 'world', 'b2b', 'tool']);
  });
});
