export interface ChunkInput {
  index: number;
  text: string;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/** Split one long paragraph into sentence-sized pieces under maxChars. */
function splitLongParagraph(paragraph: string, maxChars: number): string[] {
  const sentences = paragraph.split(SENTENCE_SPLIT).filter((s) => s.trim().length > 0);
  const pieces: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && (current + ' ' + sentence).length > maxChars) {
      pieces.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) pieces.push(current.trim());
  // A single sentence longer than maxChars is hard-split so nothing is dropped.
  return pieces.flatMap((p) => {
    if (p.length <= maxChars) return [p];
    const out: string[] = [];
    for (let i = 0; i < p.length; i += maxChars) out.push(p.slice(i, i + maxChars));
    return out;
  });
}

/**
 * Paragraph-aware chunking with character overlap between neighbours.
 * Overlap carries trailing context into the next chunk so answers that span
 * a boundary are still retrievable.
 */
export function splitIntoChunks(text: string, maxChars = 1200, overlap = 200): ChunkInput[] {
  // Give header lines (short, no terminal punctuation) a period so they do
  // not glue onto the following sentence during paragraph normalization.
  const withHeaderPeriods = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const t = line.trim();
      return t.length > 0 && t.length < 70 && !/[.!?:;]$/.test(t) ? t + '.' : line;
    })
    .join('\n');
  const clean = withHeaderPeriods.trim();
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 0);

  const units = paragraphs.flatMap((p) => (p.length > maxChars ? splitLongParagraph(p, maxChars) : [p]));

  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    if (current && (current + '\n\n' + unit).length > maxChars) {
      chunks.push(current);
      const tail = overlap > 0 ? current.slice(-overlap) : '';
      current = tail ? tail + '\n\n' + unit : unit;
    } else {
      current = current ? current + '\n\n' + unit : unit;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((text, index) => ({ index, text }));
}
