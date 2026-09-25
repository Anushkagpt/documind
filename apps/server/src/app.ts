import express from 'express';
import cors from 'cors';
import { config, aiProvider } from './config';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import askRoutes from './routes/ask';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.webOrigin === '*' ? true : config.webOrigin.split(',') }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, provider: aiProvider, mode: config.demoMode ? 'demo' : 'postgres' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/ask', askRoutes);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
