import { createApp } from './app';
import { config } from './config';
import { startIngestWorker } from './lib/queue';
import { seedDemoData } from './demoData';

async function main() {
  if (config.demoMode) {
    await seedDemoData();
    console.log('Demo mode: in-memory store, no Postgres/Redis needed');
  } else {
    startIngestWorker();
  }
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`DocuMind API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
