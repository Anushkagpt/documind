import { describe, it, expect } from 'vitest';
import { splitIntoChunks } from '../src/lib/chunker';

const paragraph = (n: number) =>
  Array.from({ length: n }, (_, i) => `Sentence number ${i + 1} of this paragraph.`).join(' ');

describe('splitIntoChunks', () => {
  it('returns an empty array for empty input', () => {
    expect(splitIntoChunks('')).toEqual([]);
    expect(splitIntoChunks('   \n\n  ')).toEqual([]);
  });

  it('keeps short documents in one chunk', () => {
    const chunks = splitIntoChunks('A short document. Two sentences.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
  });

  it('splits long documents into multiple chunks that cover all text', () => {
    const text = [paragraph(40), paragraph(40), paragraph(40)].join('\n\n');
    const chunks = splitIntoChunks(text, 800, 100);
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(900);
    // every sentence appears in at least one chunk
    expect(chunks.map((c) => c.text).join(' ')).toContain('Sentence number 40 of this paragraph.');
  });

  it('carries overlap context into the next chunk', () => {
    const text = [paragraph(30), paragraph(30)].join('\n\n');
    const chunks = splitIntoChunks(text, 800, 120);
    expect(chunks.length).toBeGreaterThan(1);
    const tailOfFirst = chunks[0].text.slice(-80);
    expect(chunks[1].text.startsWith(chunks[0].text.slice(-120))).toBe(true);
    expect(tailOfFirst.length).toBe(80);
  });

  it('hard-splits a single oversized sentence without dropping content', () => {
    const text = 'x'.repeat(5000);
    const chunks = splitIntoChunks(text, 1000, 0);
    expect(chunks.length).toBe(5);
    expect(chunks.map((c) => c.text).join('')).toBe(text);
  });
});
