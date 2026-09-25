import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  jwtSecret: process.env.JWT_SECRET || 'documind-dev-secret-change-me',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  // DEMO_MODE=true forces the in-memory store even if DATABASE_URL is set.
  demoMode: process.env.DEMO_MODE === 'true' || !process.env.DATABASE_URL,
};

export const aiProvider = config.geminiApiKey ? 'gemini' : 'local';
