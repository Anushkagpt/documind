import { randomUUID } from 'crypto';
import { prisma } from '../db';
import { config } from '../config';

export interface StoredUser {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
}

export interface StoredDocument {
  id: string;
  userId: string;
  title: string;
  sourceType: string;
  status: string;
  chunkCount: number;
  error: string | null;
  createdAt: Date;
}

export interface NewChunk {
  documentId: string;
  index: number;
  text: string;
  embedding: number[];
  tokenCount: number;
}

export interface ChunkWithDoc {
  id: string;
  documentId: string;
  documentTitle: string;
  index: number;
  text: string;
  embedding: number[];
}

export interface Store {
  createUser(email: string, name: string | null, passwordHash: string): Promise<StoredUser>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createDocument(userId: string, title: string, sourceType: string): Promise<StoredDocument>;
  listDocuments(userId: string): Promise<StoredDocument[]>;
  getDocument(userId: string, id: string): Promise<StoredDocument | null>;
  setDocumentStatus(id: string, status: string, chunkCount: number, error?: string | null): Promise<void>;
  deleteDocument(userId: string, id: string): Promise<boolean>;
  replaceChunks(documentId: string, chunks: NewChunk[]): Promise<void>;
  chunksForUser(userId: string, documentId?: string): Promise<ChunkWithDoc[]>;
  logQuery(userId: string, question: string, answer: string, provider: string): Promise<void>;
  recentQueries(userId: string, limit: number): Promise<{ question: string; createdAt: Date }[]>;
}

class PrismaStore implements Store {
  async createUser(email: string, name: string | null, passwordHash: string) {
    return prisma.user.create({ data: { email, name, passwordHash } });
  }
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }
  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
  async createDocument(userId: string, title: string, sourceType: string) {
    return prisma.document.create({ data: { userId, title, sourceType } });
  }
  async listDocuments(userId: string) {
    return prisma.document.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
  async getDocument(userId: string, id: string) {
    const doc = await prisma.document.findFirst({ where: { id, userId } });
    return doc;
  }
  async setDocumentStatus(id: string, status: string, chunkCount: number, error: string | null = null) {
    await prisma.document.update({ where: { id }, data: { status, chunkCount, error } });
  }
  async deleteDocument(userId: string, id: string) {
    const result = await prisma.document.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
  async replaceChunks(documentId: string, chunks: NewChunk[]) {
    await prisma.$transaction([
      prisma.chunk.deleteMany({ where: { documentId } }),
      prisma.chunk.createMany({
        data: chunks.map((c) => ({
          documentId: c.documentId,
          index: c.index,
          text: c.text,
          embedding: c.embedding,
          tokenCount: c.tokenCount,
        })),
      }),
    ]);
  }
  async chunksForUser(userId: string, documentId?: string) {
    const rows = await prisma.chunk.findMany({
      where: { document: { userId, ...(documentId ? { id: documentId } : {}) } },
      include: { document: { select: { title: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      documentId: r.documentId,
      documentTitle: r.document.title,
      index: r.index,
      text: r.text,
      embedding: r.embedding,
    }));
  }
  async logQuery(userId: string, question: string, answer: string, provider: string) {
    await prisma.queryLog.create({ data: { userId, question, answer, provider } });
  }
  async recentQueries(userId: string, limit: number) {
    return prisma.queryLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { question: true, createdAt: true },
    });
  }
}

class MemoryStore implements Store {
  users = new Map<string, StoredUser>();
  documents = new Map<string, StoredDocument>();
  chunks = new Map<string, (NewChunk & { id: string })[]>();
  queries: { userId: string; question: string; answer: string; createdAt: Date }[] = [];

  async createUser(email: string, name: string | null, passwordHash: string) {
    const user: StoredUser = { id: randomUUID(), email, name, passwordHash };
    this.users.set(user.id, user);
    return user;
  }
  async findUserByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) || null;
  }
  async findUserById(id: string) {
    return this.users.get(id) || null;
  }
  async createDocument(userId: string, title: string, sourceType: string) {
    const doc: StoredDocument = {
      id: randomUUID(), userId, title, sourceType,
      status: 'processing', chunkCount: 0, error: null, createdAt: new Date(),
    };
    this.documents.set(doc.id, doc);
    return doc;
  }
  async listDocuments(userId: string) {
    return [...this.documents.values()]
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async getDocument(userId: string, id: string) {
    const doc = this.documents.get(id);
    return doc && doc.userId === userId ? doc : null;
  }
  async setDocumentStatus(id: string, status: string, chunkCount: number, error: string | null = null) {
    const doc = this.documents.get(id);
    if (doc) Object.assign(doc, { status, chunkCount, error });
  }
  async deleteDocument(userId: string, id: string) {
    const doc = this.documents.get(id);
    if (!doc || doc.userId !== userId) return false;
    this.documents.delete(id);
    this.chunks.delete(id);
    return true;
  }
  async replaceChunks(documentId: string, chunks: NewChunk[]) {
    this.chunks.set(documentId, chunks.map((c) => ({ ...c, id: randomUUID() })));
  }
  async chunksForUser(userId: string, documentId?: string) {
    const out: ChunkWithDoc[] = [];
    for (const [docId, chunks] of this.chunks) {
      const doc = this.documents.get(docId);
      if (!doc || doc.userId !== userId) continue;
      if (documentId && docId !== documentId) continue;
      for (const c of chunks) {
        out.push({ id: c.id, documentId: docId, documentTitle: doc.title, index: c.index, text: c.text, embedding: c.embedding });
      }
    }
    return out;
  }
  async logQuery(userId: string, question: string, answer: string) {
    this.queries.unshift({ userId, question, answer, createdAt: new Date() });
  }
  async recentQueries(userId: string, limit: number) {
    return this.queries.filter((q) => q.userId === userId).slice(0, limit)
      .map((q) => ({ question: q.question, createdAt: q.createdAt }));
  }
}

export const memoryStore = new MemoryStore();

export function getStore(): Store {
  return config.demoMode ? memoryStore : new PrismaStore();
}
