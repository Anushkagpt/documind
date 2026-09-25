/**
 * Seed the demo account and two sample documents into Postgres.
 * Usage: DATABASE_URL=... npm run db:seed
 * Uses whichever embedding provider is configured (Gemini if GEMINI_API_KEY
 * is set, otherwise the local embedder), matching runtime behaviour.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { splitIntoChunks } from '../src/lib/chunker';
import { embedTexts } from '../src/lib/gemini';
import { tokenize } from '../src/lib/embeddings';
import { SAMPLE_HANDBOOK, SAMPLE_SPEC } from '../src/demoData';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@documind.dev';
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Demo User', passwordHash },
  });
  for (const [title, text] of [
    ['Employee Handbook', SAMPLE_HANDBOOK],
    ['Product Spec - Relay Board', SAMPLE_SPEC],
  ] as const) {
    const chunks = splitIntoChunks(text);
    const embeddings = await embedTexts(chunks.map((c) => c.text));
    const doc = await prisma.document.create({
      data: {
        userId: user.id,
        title,
        sourceType: 'text',
        status: 'ready',
        chunkCount: chunks.length,
        chunks: {
          create: chunks.map((c, i) => ({
            index: c.index,
            text: c.text,
            embedding: embeddings[i],
            tokenCount: tokenize(c.text).length,
          })),
        },
      },
    });
    console.log(`seeded document "${doc.title}" (${chunks.length} chunks)`);
  }
  console.log('Seed done. Demo login: demo@documind.dev / password123');
}

main().finally(() => prisma.$disconnect());
